import os
import socket
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

pool = ConnectionPool(
    os.environ["DATABASE_URL"], kwargs={"row_factory": dict_row}, check=ConnectionPool.check_connection, open=False
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(title="Question Service", lifespan=lifespan)

Limit = Query(50, ge=1, le=200)
Offset = Query(0, ge=0)

SELECT = """
    SELECT q.id, q.prompt, q.answer_type, q.difficulty,
           t.id AS topic_id, t.code AS topic_code, t.name AS topic, u.name AS unit, co.code AS course
    FROM questions q
    JOIN topics t ON t.id = q.topic_id
    JOIN units u ON u.id = t.unit_id
    JOIN courses co ON co.id = u.course_id
"""


def fetch_all(sql, params=()):
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(sql, params=()):
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchone()


def where(filters):
    clauses, params = [], []
    for clause, value in filters:
        if value is not None:
            clauses.append(clause)
            params.extend([value] * clause.count("%s"))
    return (" WHERE " + " AND ".join(clauses) if clauses else ""), params


def filters(course, code, topic_id, difficulty, answer_type):
    return where([
        ("co.code = upper(%s)", course),
        ("t.code = upper(%s)", code),
        ("t.id = %s", topic_id),
        ("q.difficulty = %s", difficulty),
        ("q.answer_type = %s", answer_type),
    ])


@app.get("/")
def root():
    return {"service": "question", "pod": socket.gethostname()}


@app.get("/health")
def health():
    fetch_one("SELECT 1")
    return {"status": "ok"}


@app.get("/questions")
def list_questions(
    course: str | None = None,
    code: str | None = None,
    topic_id: int | None = None,
    difficulty: int | None = Query(None, ge=1, le=3),
    answer_type: str | None = None,
    limit: int = Limit,
    offset: int = Offset,
):
    """Questions, filtered by course code, topic code, topic ID, difficulty (1-3) or answer type. Answers are not included; mark them with the answer service."""
    clause, params = filters(course, code, topic_id, difficulty, answer_type)
    total = fetch_one(
        f"SELECT COUNT(*) AS total FROM questions q JOIN topics t ON t.id = q.topic_id "
        f"JOIN units u ON u.id = t.unit_id JOIN courses co ON co.id = u.course_id{clause}",
        params,
    )["total"]
    items = fetch_all(f"{SELECT}{clause} ORDER BY q.id LIMIT %s OFFSET %s", (*params, limit, offset))
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/questions/random")
def random_questions(
    course: str | None = None,
    code: str | None = None,
    topic_id: int | None = None,
    difficulty: int | None = Query(None, ge=1, le=3),
    answer_type: str | None = None,
    count: int = Query(10, ge=1, le=50),
):
    """Random questions matching the same filters, e.g. for a quiz."""
    clause, params = filters(course, code, topic_id, difficulty, answer_type)
    return fetch_all(f"{SELECT}{clause} ORDER BY random() LIMIT %s", (*params, count))


@app.get("/questions/{question_id}")
def get_question(question_id: int):
    """One question by ID."""
    question = fetch_one(f"{SELECT} WHERE q.id = %s", (question_id,))
    if not question:
        raise HTTPException(404, "Question not found")
    return question


@app.get("/topics")
def topics_with_questions(course: str | None = None):
    """Topics that have questions, with how many each has, optionally for one course."""
    clause, params = where([("co.code = upper(%s)", course)])
    return fetch_all(
        f"""
        SELECT t.id, t.code, t.name, u.name AS unit, co.code AS course, COUNT(q.id) AS questions
        FROM topics t
        JOIN questions q ON q.topic_id = t.id
        JOIN units u ON u.id = t.unit_id
        JOIN courses co ON co.id = u.course_id
        {clause} GROUP BY t.id, u.id, co.id ORDER BY co.curriculum_id, co.position, u.position, t.position
        """,
        params,
    )
