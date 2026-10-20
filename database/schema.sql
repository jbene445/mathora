CREATE TABLE curriculum (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    authority TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    curriculum_id INTEGER NOT NULL REFERENCES curriculum (id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (curriculum_id, code)
);

CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES topics (id) ON DELETE CASCADE,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    hours INTEGER,
    position INTEGER NOT NULL
);

CREATE TABLE outcomes (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    position INTEGER NOT NULL
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL,
    answer_type TEXT NOT NULL CHECK (answer_type IN ('integer', 'decimal', 'fraction', 'set', 'expression', 'expanded', 'factored', 'simplified')),
    difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 3)
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    course TEXT,
    code TEXT,
    topic_id INTEGER REFERENCES topics (id) ON DELETE SET NULL,
    difficulty SMALLINT,
    total INTEGER NOT NULL,
    correct INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ
);

CREATE TABLE quiz_questions (
    quiz_id INTEGER NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    question_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
    question JSONB NOT NULL,
    answer TEXT,
    correct BOOLEAN,
    expected TEXT,
    PRIMARY KEY (quiz_id, position)
);

CREATE TABLE attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES quizzes (id) ON DELETE SET NULL,
    answer TEXT NOT NULL,
    correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON courses (curriculum_id);
CREATE INDEX ON units (course_id);
CREATE INDEX ON topics (unit_id);
CREATE INDEX ON topics (parent_id);
CREATE INDEX ON outcomes (topic_id);
CREATE INDEX ON questions (topic_id, difficulty);
CREATE UNIQUE INDEX ON users (lower(username));
CREATE INDEX ON sessions (user_id);
CREATE INDEX ON quizzes (user_id, created_at);
CREATE INDEX ON attempts (user_id, created_at);
CREATE INDEX ON attempts (question_id);
CREATE INDEX ON topics USING GIN (to_tsvector('english', name));
CREATE INDEX ON outcomes USING GIN (to_tsvector('english', description));
