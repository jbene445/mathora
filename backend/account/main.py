import hashlib
import hmac
import os
import secrets
import socket
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Header, HTTPException, Response
from psycopg.errors import UniqueViolation
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


app = FastAPI(title="Account Service", lifespan=lifespan)

SESSION_LENGTH = timedelta(days=7)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern="^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)


def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def check_password(password, stored):
    _, salt, digest = stored.split("$")
    attempt = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(attempt.hex(), digest)


DUMMY_HASH = hash_password(secrets.token_hex(16))


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def bearer(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Log in first")
    return authorization.removeprefix("Bearer ").strip()


@app.get("/")
def root():
    return {"service": "account", "pod": socket.gethostname()}


@app.get("/health")
def health():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.post("/register", status_code=201)
def register(body: Credentials):
    try:
        with pool.connection() as conn:
            return conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id, username, created_at",
                (body.username, hash_password(body.password)),
            ).fetchone()
    except UniqueViolation:
        raise HTTPException(409, "That username is taken")


@app.post("/login")
def login(body: Credentials):
    with pool.connection() as conn:
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE lower(username) = lower(%s)", (body.username,)
        ).fetchone()
        if not check_password(body.password, user["password_hash"] if user else DUMMY_HASH) or not user:
            raise HTTPException(401, "Wrong username or password")
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + SESSION_LENGTH
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)", (token_hash(token), user["id"], expires)
        )
        conn.execute("DELETE FROM sessions WHERE user_id = %s AND expires_at < now()", (user["id"],))
    return {"token": token, "expires_at": expires, "user": {"id": user["id"], "username": user["username"]}}


@app.post("/logout", status_code=204)
def logout(authorization: str | None = Header(None)):
    with pool.connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash(bearer(authorization)),))
    return Response(status_code=204)


@app.get("/me")
def me(authorization: str | None = Header(None)):
    """Used by other services to find out who a token belongs to."""
    with pool.connection() as conn:
        user = conn.execute(
            """
            SELECT u.id, u.username, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s AND s.expires_at > now()
            """,
            (token_hash(bearer(authorization)),),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Session expired or invalid")
    return user
