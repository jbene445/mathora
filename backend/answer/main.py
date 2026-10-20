import os
import re
import socket
from contextlib import asynccontextmanager
from fractions import Fraction

import httpx
from fastapi import FastAPI, Header, HTTPException
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


app = FastAPI(title="Answer Service", lifespan=lifespan)

solver = httpx.Client(base_url=os.environ.get("SOLVER_URL", "http://solver:8000"), timeout=5)
progress = httpx.Client(base_url=os.environ.get("PROGRESS_URL", "http://progress:8000"), timeout=5)
FORMS = {"expression": "any", "expanded": "expanded", "factored": "factored", "simplified": "simplified"}


class Attempt(BaseModel):
    question_id: int
    answer: str = Field(max_length=200)


class Batch(BaseModel):
    answers: list[Attempt] = Field(min_length=1, max_length=50)


def number(text):
    """Parse '7', '-3', '2.5', '3/4', '1 1/2', 'x = 4' into an exact Fraction; None if it isn't a number."""
    text = text.strip().lower().replace("−", "-").replace("–", "-").replace("$", "")
    text = re.sub(r"^[a-z]\s*=\s*", "", text)
    text = re.sub(r"(?<=\d),(?=\d{3}\b)", "", text)
    mixed = re.fullmatch(r"(-?)(\d+)\s+(\d+)\s*/\s*(\d+)", text)
    if mixed:
        sign, whole, num, den = mixed.groups()
        value = int(whole) + Fraction(int(num), int(den))
        return -value if sign else value
    try:
        return Fraction(text.replace(" ", ""))
    except (ValueError, ZeroDivisionError):
        return None


def same_expression(given, expected, form):
    if expected.endswith("+ c"):
        expected = expected[: -len("+ c")]
        given = re.sub(r"\+\s*[cC]\s*$", "", given.strip())
    response = solver.post("/equivalent", json={"a": given, "b": expected, "form": form})
    if response.status_code == 400:
        return False
    response.raise_for_status()
    return response.json()["equivalent"]


def is_correct(given, expected, answer_type):
    if answer_type in FORMS:
        return same_expression(given, expected, FORMS[answer_type])
    if answer_type == "set":
        parts = [number(p) for p in re.split(r"\s*(?:,|;|\bor\b|\band\b)\s*", given.strip()) if p]
        return None not in parts and sorted(parts) == sorted(number(p) for p in expected.split(","))
    value = number(given)
    return value is not None and value == number(expected)


def mark(attempts):
    ids = [a.question_id for a in attempts]
    with pool.connection() as conn:
        rows = conn.execute("SELECT id, answer, answer_type FROM questions WHERE id = ANY(%s)", (ids,)).fetchall()
    questions = {r["id"]: r for r in rows}
    results = []
    for a in attempts:
        q = questions.get(a.question_id)
        if q is None:
            raise HTTPException(404, f"Question {a.question_id} not found")
        results.append({
            "question_id": a.question_id,
            "given": a.answer,
            "correct": is_correct(a.answer, q["answer"], q["answer_type"]),
            "expected": q["answer"],
        })
    return results


@app.get("/")
def root():
    return {"service": "answer", "pod": socket.gethostname()}


@app.get("/health")
def health():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


def record(results, authorization):
    """Send marked answers to the progress service; marking still works if this fails."""
    if not authorization:
        return False
    try:
        response = progress.post("/attempts", headers={"Authorization": authorization}, json={
            "attempts": [{"question_id": r["question_id"], "answer": r["given"], "correct": r["correct"]} for r in results]})
        return response.status_code == 201
    except httpx.HTTPError:
        return False


@app.post("/check")
def check(attempt: Attempt, authorization: str | None = Header(None)):
    """Mark one answer. Numbers can be integers, decimals, fractions or mixed numbers; algebra is marked by the solver."""
    result = mark([attempt])[0]
    return {**result, "recorded": record([result], authorization)}


@app.post("/check/batch")
def check_batch(batch: Batch, authorization: str | None = Header(None)):
    """Mark up to 50 answers at once, with the total score."""
    results = mark(batch.answers)
    correct = sum(r["correct"] for r in results)
    return {"results": results, "correct": correct, "total": len(results), "score": round(100 * correct / len(results)),
            "recorded": record(results, authorization)}
