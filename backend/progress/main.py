import os
import socket
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from psycopg.rows import dict_row
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


app = FastAPI(title="Progress Service", lifespan=lifespan)

account = httpx.Client(base_url=os.environ.get("ACCOUNT_URL", "http://account:8000"), timeout=5)

TARGET_ACCURACY = 0.7
MIN_ATTEMPTS = 3


def current_user(authorization: str | None = Header(None)):
    if not authorization:
        raise HTTPException(401, "Log in first")
    try:
        response = account.get("/me", headers={"Authorization": authorization})
    except httpx.HTTPError:
        raise HTTPException(503, "Account service unavailable, try again")
    if response.status_code != 200:
        raise HTTPException(401, "Session expired or invalid")
    return response.json()


class Attempt(BaseModel):
    question_id: int
    answer: str = Field(max_length=200)
    correct: bool


class Attempts(BaseModel):
    attempts: list[Attempt] = Field(min_length=1, max_length=50)
    quiz_id: int | None = None


def fetch_all(sql, params=()):
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(sql, params=()):
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchone()


TOPIC_JOIN = """
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses co ON co.id = u.course_id
"""


@app.get("/")
def root():
    return {"service": "progress", "pod": socket.gethostname()}


@app.get("/health")
def health():
    fetch_one("SELECT 1")
    return {"status": "ok"}


@app.post("/attempts", status_code=201)
def record(body: Attempts, user=Depends(current_user)):
    """Called by the answer and quiz services after marking; blocked for browsers by Nginx."""
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO attempts (user_id, question_id, quiz_id, answer, correct) VALUES (%s, %s, %s, %s, %s)",
                [(user["id"], a.question_id, body.quiz_id, a.answer, a.correct) for a in body.attempts],
            )
    return {"recorded": len(body.attempts)}


@app.get("/me/summary")
def summary(user=Depends(current_user)):
    totals = fetch_one(
        """
        SELECT COUNT(*) AS answered, COUNT(*) FILTER (WHERE correct) AS correct,
               COUNT(DISTINCT question_id) AS questions, MAX(created_at) AS last_active
        FROM attempts WHERE user_id = %s
        """,
        (user["id"],),
    )
    quiz = fetch_one(
        """
        SELECT COUNT(*) AS quizzes, ROUND(AVG(100.0 * correct / total), 1) AS average_quiz_score
        FROM quizzes WHERE user_id = %s AND submitted_at IS NOT NULL
        """,
        (user["id"],),
    )
    accuracy = round(100 * totals["correct"] / totals["answered"], 1) if totals["answered"] else None
    return {"username": user["username"], **totals, "accuracy": accuracy, **quiz}


@app.get("/me/courses")
def courses(user=Depends(current_user)):
    return fetch_all(
        f"""
        SELECT co.code AS course, co.name, COUNT(*) AS answered, COUNT(*) FILTER (WHERE a.correct) AS correct,
               ROUND(100.0 * COUNT(*) FILTER (WHERE a.correct) / COUNT(*), 1) AS accuracy
        {TOPIC_JOIN} WHERE a.user_id = %s
        GROUP BY co.id ORDER BY co.curriculum_id, co.position
        """,
        (user["id"],),
    )


@app.get("/me/topics")
def topics(course: str | None = None, user=Depends(current_user)):
    """Accuracy per topic, weakest first."""
    course_filter = "AND co.code = upper(%s)" if course else ""
    params = (user["id"], course) if course else (user["id"],)
    return fetch_all(
        f"""
        SELECT t.id AS topic_id, t.code, t.name AS topic, u.name AS unit, co.code AS course,
               COUNT(*) AS answered, COUNT(*) FILTER (WHERE a.correct) AS correct,
               ROUND(100.0 * COUNT(*) FILTER (WHERE a.correct) / COUNT(*), 1) AS accuracy,
               MAX(a.created_at) AS last_attempt
        {TOPIC_JOIN} WHERE a.user_id = %s {course_filter}
        GROUP BY t.id, u.id, co.id ORDER BY accuracy, answered DESC
        """,
        params,
    )


@app.get("/me/history")
def history(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), user=Depends(current_user)):
    items = fetch_all(
        f"""
        SELECT a.id, a.question_id, q.prompt, a.answer, a.correct, a.quiz_id, a.created_at,
               t.code, t.name AS topic, co.code AS course
        {TOPIC_JOIN} WHERE a.user_id = %s ORDER BY a.created_at DESC, a.id DESC LIMIT %s OFFSET %s
        """,
        (user["id"], limit, offset),
    )
    total = fetch_one("SELECT COUNT(*) AS total FROM attempts WHERE user_id = %s", (user["id"],))["total"]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/me/recommendations")
def recommendations(limit: int = Query(5, ge=1, le=20), user=Depends(current_user)):
    """Weak topics first; then untried topics in the courses the user has been practising."""
    weak = fetch_all(
        f"""
        SELECT t.id AS topic_id, t.code, t.name AS topic, co.code AS course,
               ROUND(100.0 * COUNT(*) FILTER (WHERE a.correct) / COUNT(*), 1) AS accuracy, COUNT(*) AS answered
        {TOPIC_JOIN} WHERE a.user_id = %s
        GROUP BY t.id, co.id
        HAVING COUNT(*) >= %s AND 1.0 * COUNT(*) FILTER (WHERE a.correct) / COUNT(*) < %s
        ORDER BY accuracy LIMIT %s
        """,
        (user["id"], MIN_ATTEMPTS, TARGET_ACCURACY, limit),
    )
    for w in weak:
        w["reason"] = f"{w['accuracy']}% correct over {w['answered']} questions"
    untried = fetch_all(
        """
        SELECT t.id AS topic_id, t.code, t.name AS topic, co.code AS course
        FROM topics t
        JOIN units u ON u.id = t.unit_id
        JOIN courses co ON co.id = u.course_id
        WHERE EXISTS (SELECT 1 FROM questions q WHERE q.topic_id = t.id)
          AND co.id IN (
              SELECT u2.course_id FROM attempts a JOIN questions q ON q.id = a.question_id
              JOIN topics t2 ON t2.id = q.topic_id JOIN units u2 ON u2.id = t2.unit_id WHERE a.user_id = %s)
          AND NOT EXISTS (
              SELECT 1 FROM attempts a JOIN questions q ON q.id = a.question_id WHERE a.user_id = %s AND q.topic_id = t.id)
        ORDER BY co.position, u.position, t.position LIMIT %s
        """,
        (user["id"], user["id"], max(0, limit - len(weak))),
    )
    for u in untried:
        u["reason"] = "Not tried yet"
    return weak + untried
