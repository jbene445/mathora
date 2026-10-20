import os
import socket
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

pool = ConnectionPool(
    os.environ["DATABASE_URL"], kwargs={"row_factory": dict_row}, check=ConnectionPool.check_connection, open=False
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(title="Quiz Service", lifespan=lifespan)


def client(name, default):
    return httpx.Client(base_url=os.environ.get(name, default), timeout=10)


account = client("ACCOUNT_URL", "http://account:8000")
questions = client("QUESTION_URL", "http://question:8000")
answers = client("ANSWER_URL", "http://answer:8000")
progress = client("PROGRESS_URL", "http://progress:8000")


def current_user(authorization: str | None = Header(None)):
    if not authorization:
        raise HTTPException(401, "Log in first")
    try:
        response = account.get("/me", headers={"Authorization": authorization})
    except httpx.HTTPError:
        raise HTTPException(503, "Account service unavailable, try again")
    if response.status_code != 200:
        raise HTTPException(401, "Session expired or invalid")
    return {**response.json(), "authorization": authorization}


class NewQuiz(BaseModel):
    course: str | None = Field(None, max_length=10)
    code: str | None = Field(None, max_length=20)
    topic_id: int | None = None
    difficulty: int | None = Field(None, ge=1, le=3)
    count: int = Field(10, ge=1, le=50)


class Answer(BaseModel):
    question_id: int
    answer: str = Field(max_length=200)


class Submission(BaseModel):
    answers: list[Answer] = Field(max_length=50)


def owned_quiz(conn, quiz_id, user):
    quiz = conn.execute(
        "SELECT id, user_id, course, code, topic_id, difficulty, total, correct, created_at, submitted_at FROM quizzes WHERE id = %s",
        (quiz_id,),
    ).fetchone()
    if not quiz or quiz["user_id"] != user["id"]:
        raise HTTPException(404, "Quiz not found")
    return quiz


def show(quiz, rows):
    quiz = {k: v for k, v in quiz.items() if k != "user_id"}
    submitted = quiz["submitted_at"] is not None
    quiz["score"] = round(100 * quiz["correct"] / quiz["total"]) if submitted else None
    quiz["questions"] = [
        {**r["question"], "position": r["position"], **({"answer": r["answer"], "correct": r["correct"], "expected": r["expected"]} if submitted else {})}
        for r in rows
    ]
    return quiz


@app.get("/")
def root():
    return {"service": "quiz", "pod": socket.gethostname()}


@app.get("/health")
def health():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.post("/quizzes", status_code=201)
def create_quiz(body: NewQuiz, user=Depends(current_user)):
    filters = {k: v for k, v in body.model_dump().items() if v is not None}
    response = questions.get("/questions/random", params=filters)
    if response.status_code == 422:
        raise HTTPException(422, response.json()["detail"])
    response.raise_for_status()
    picked = response.json()
    if not picked:
        raise HTTPException(404, "No questions match those filters")
    with pool.connection() as conn:
        quiz = conn.execute(
            """
            INSERT INTO quizzes (user_id, course, code, topic_id, difficulty, total) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, course, code, topic_id, difficulty, total, correct, created_at, submitted_at
            """,
            (user["id"], body.course, body.code, body.topic_id, body.difficulty, len(picked)),
        ).fetchone()
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO quiz_questions (quiz_id, position, question_id, question) VALUES (%s, %s, %s, %s)",
                [(quiz["id"], i + 1, q["id"], Jsonb(q)) for i, q in enumerate(picked)],
            )
    return show(quiz, [{"position": i + 1, "question": q} for i, q in enumerate(picked)])


@app.get("/quizzes")
def list_quizzes(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), user=Depends(current_user)):
    with pool.connection() as conn:
        items = conn.execute(
            """
            SELECT z.id, z.course, z.code, z.topic_id, t.name AS topic, z.difficulty, z.total, z.correct, z.created_at, z.submitted_at,
                   CASE WHEN z.submitted_at IS NOT NULL THEN ROUND(100.0 * z.correct / z.total) END AS score
            FROM quizzes z LEFT JOIN topics t ON t.id = z.topic_id OR (z.topic_id IS NULL AND t.code = upper(z.code))
            WHERE z.user_id = %s ORDER BY z.created_at DESC, z.id DESC LIMIT %s OFFSET %s
            """,
            (user["id"], limit, offset),
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) AS total FROM quizzes WHERE user_id = %s", (user["id"],)).fetchone()["total"]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: int, user=Depends(current_user)):
    """The questions (no answers); once submitted, also the given and expected answers."""
    with pool.connection() as conn:
        quiz = owned_quiz(conn, quiz_id, user)
        rows = conn.execute(
            "SELECT position, question, answer, correct, expected FROM quiz_questions WHERE quiz_id = %s ORDER BY position",
            (quiz_id,),
        ).fetchall()
    return show(quiz, rows)


@app.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: int, body: Submission, user=Depends(current_user)):
    with pool.connection() as conn:
        quiz = owned_quiz(conn, quiz_id, user)
        if quiz["submitted_at"]:
            raise HTTPException(409, "This quiz has already been submitted")
        rows = conn.execute(
            "SELECT position, question_id, question FROM quiz_questions WHERE quiz_id = %s ORDER BY position", (quiz_id,)
        ).fetchall()

    given = {a.question_id: a.answer for a in body.answers}
    unknown = set(given) - {r["question_id"] for r in rows}
    if unknown:
        raise HTTPException(400, f"Questions {sorted(unknown)} are not in this quiz")
    attempts = [{"question_id": r["question_id"], "answer": given.get(r["question_id"], "")} for r in rows]

    response = answers.post("/check/batch", json={"answers": attempts})
    response.raise_for_status()
    results = [{**a, "correct": r["correct"], "expected": r["expected"]} for a, r in zip(attempts, response.json()["results"])]
    correct = sum(r["correct"] for r in results)

    with pool.connection() as conn:
        claimed = conn.execute(
            "UPDATE quizzes SET submitted_at = now(), correct = %s WHERE id = %s AND submitted_at IS NULL RETURNING id",
            (correct, quiz_id),
        ).fetchone()
        if not claimed:
            raise HTTPException(409, "This quiz has already been submitted")
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE quiz_questions SET answer = %s, correct = %s, expected = %s WHERE quiz_id = %s AND question_id = %s",
                [(r["answer"], r["correct"], r["expected"], quiz_id, r["question_id"]) for r in results],
            )

    answered = [{"question_id": r["question_id"], "answer": r["answer"], "correct": r["correct"]} for r in results if r["answer"].strip()]
    if answered:
        progress.post("/attempts", json={"attempts": answered, "quiz_id": quiz_id},
                      headers={"Authorization": user["authorization"]}).raise_for_status()
    return get_quiz(quiz_id, user)
