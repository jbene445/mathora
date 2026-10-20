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


app = FastAPI(title="Curriculum Service", lifespan=lifespan)

Limit = Query(50, ge=1, le=200)
Offset = Query(0, ge=0)


def fetch_all(sql, params=()):
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(sql, params=()):
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchone()


def page(sql, params, limit, offset):
    rows = fetch_all(f"{sql} LIMIT %s OFFSET %s", (*params, limit, offset))
    total = rows[0].pop("total") if rows else 0
    for row in rows[1:]:
        row.pop("total")
    return {"items": rows, "total": total, "limit": limit, "offset": offset}


def where(filters):
    clauses, params = [], []
    for clause, value in filters:
        if value is not None:
            clauses.append(clause)
            params.extend([value] * clause.count("%s"))
    return (" WHERE " + " AND ".join(clauses) if clauses else ""), params


@app.get("/")
def root():
    return {"service": "curriculum", "pod": socket.gethostname()}


@app.get("/health")
def health():
    fetch_one("SELECT 1")
    return {"status": "ok"}


@app.get("/curriculum")
def list_curriculum():
    """The curriculum documents, with how many courses each has."""
    return fetch_all(
        """
        SELECT c.id, c.code, c.name, c.authority, c.version, COUNT(co.id) AS courses
        FROM curriculum c LEFT JOIN courses co ON co.curriculum_id = c.id
        GROUP BY c.id ORDER BY c.id
        """
    )


@app.get("/curriculum/{code}")
def get_curriculum(code: str):
    """One curriculum by code (AC9 or QCAA), with its courses."""
    curriculum = fetch_one("SELECT id, code, name, authority, version FROM curriculum WHERE code = %s", (code,))
    if not curriculum:
        raise HTTPException(404, "Curriculum not found")
    curriculum["courses"] = fetch_all(
        "SELECT id, code, name FROM courses WHERE curriculum_id = %s ORDER BY position", (curriculum["id"],)
    )
    return curriculum


@app.get("/courses")
def list_courses(curriculum: str | None = None, limit: int = Limit, offset: int = Offset):
    """Courses (year levels and senior subjects), optionally for one curriculum."""
    clause, params = where([("cu.code = %s", curriculum)])
    return page(
        f"""
        SELECT co.id, co.code, co.name, cu.code AS curriculum, COUNT(*) OVER () AS total
        FROM courses co JOIN curriculum cu ON cu.id = co.curriculum_id
        {clause} ORDER BY cu.id, co.position
        """,
        params, limit, offset,
    )


@app.get("/courses/{course_id}")
def get_course(course_id: int):
    """One course, with its units."""
    course = fetch_one(
        """
        SELECT co.id, co.code, co.name, cu.code AS curriculum
        FROM courses co JOIN curriculum cu ON cu.id = co.curriculum_id WHERE co.id = %s
        """,
        (course_id,),
    )
    if not course:
        raise HTTPException(404, "Course not found")
    course["units"] = fetch_all(
        """
        SELECT u.id, u.name, COUNT(t.id) AS topics
        FROM units u LEFT JOIN topics t ON t.unit_id = u.id AND t.parent_id IS NULL
        WHERE u.course_id = %s GROUP BY u.id ORDER BY u.position
        """,
        (course_id,),
    )
    return course


@app.get("/units/{unit_id}")
def get_unit(unit_id: int):
    """One unit, with its topics and subtopics."""
    unit = fetch_one(
        """
        SELECT u.id, u.name, co.id AS course_id, co.name AS course, cu.code AS curriculum
        FROM units u JOIN courses co ON co.id = u.course_id JOIN curriculum cu ON cu.id = co.curriculum_id
        WHERE u.id = %s
        """,
        (unit_id,),
    )
    if not unit:
        raise HTTPException(404, "Unit not found")
    topics = fetch_all(
        "SELECT id, parent_id, code, name, hours FROM topics WHERE unit_id = %s ORDER BY position, id", (unit_id,)
    )
    children = {}
    for topic in topics:
        children.setdefault(topic.pop("parent_id"), []).append(topic)
    for topic in topics:
        topic["subtopics"] = children.get(topic["id"], [])
    unit["topics"] = children.get(None, [])
    return unit


@app.get("/topics")
def list_topics(
    curriculum: str | None = None,
    course_id: int | None = None,
    unit_id: int | None = None,
    q: str | None = None,
    limit: int = Limit,
    offset: int = Offset,
):
    """Topics, filtered by curriculum, course or unit, or searched with q (words or a topic code)."""
    clause, params = where([
        ("cu.code = %s", curriculum),
        ("co.id = %s", course_id),
        ("u.id = %s", unit_id),
        (
            """(t.code = upper(%s)
            OR to_tsvector('english', t.name) @@ websearch_to_tsquery('english', %s)
            OR EXISTS (SELECT 1 FROM outcomes o WHERE o.topic_id = t.id
                       AND to_tsvector('english', o.description) @@ websearch_to_tsquery('english', %s)))""",
            q or None,
        ),
    ])
    return page(
        f"""
        SELECT t.id, t.code, t.name, t.hours, t.parent_id, u.id AS unit_id, u.name AS unit,
               co.id AS course_id, co.name AS course, cu.code AS curriculum, COUNT(*) OVER () AS total
        FROM topics t
        JOIN units u ON u.id = t.unit_id
        JOIN courses co ON co.id = u.course_id
        JOIN curriculum cu ON cu.id = co.curriculum_id
        {clause} ORDER BY cu.id, co.position, u.position, t.parent_id NULLS FIRST, t.position
        """,
        params, limit, offset,
    )


def topic_detail(column, value):
    topic = fetch_one(
        f"""
        SELECT t.id, t.code, t.name, t.hours, t.parent_id, u.id AS unit_id, u.name AS unit,
               co.id AS course_id, co.name AS course, cu.code AS curriculum
        FROM topics t
        JOIN units u ON u.id = t.unit_id
        JOIN courses co ON co.id = u.course_id
        JOIN curriculum cu ON cu.id = co.curriculum_id
        WHERE t.{column} = %s
        """,
        (value,),
    )
    if not topic:
        raise HTTPException(404, "Topic not found")
    topic["subtopics"] = fetch_all(
        "SELECT id, code, name, hours FROM topics WHERE parent_id = %s ORDER BY position", (topic["id"],)
    )
    topic["outcomes"] = fetch_all(
        "SELECT id, description FROM outcomes WHERE topic_id = %s ORDER BY position", (topic["id"],)
    )
    return topic


@app.get("/topics/code/{code}")
def get_topic_by_code(code: str):
    """One topic by its curriculum code, e.g. AC9M9A02, with subtopics and outcomes."""
    return topic_detail("code", code.upper())


@app.get("/topics/{topic_id}")
def get_topic(topic_id: int):
    """One topic by ID, with subtopics and outcomes."""
    return topic_detail("id", topic_id)


@app.get("/outcomes")
def list_outcomes(topic_id: int | None = None, q: str | None = None, limit: int = Limit, offset: int = Offset):
    """Outcomes (elaborations or subject matter), for one topic or searched with q."""
    clause, params = where([
        ("o.topic_id = %s", topic_id),
        ("to_tsvector('english', o.description) @@ websearch_to_tsquery('english', %s)", q),
    ])
    return page(
        f"""
        SELECT o.id, o.description, t.id AS topic_id, t.code AS topic_code, t.name AS topic,
               COUNT(*) OVER () AS total
        FROM outcomes o JOIN topics t ON t.id = o.topic_id
        {clause} ORDER BY o.topic_id, o.position
        """,
        params, limit, offset,
    )
