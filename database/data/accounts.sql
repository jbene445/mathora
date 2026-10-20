INSERT INTO users (username, password_hash, created_at) VALUES
('demo', 'scrypt$85193595a0f03495bf3fa5280b5a6b96$7aa922d074212122cb93885d2e5317fa090f58bd5be0e5d3faa52889045519a5d18dc94605b796f7ca2de3919f1a8eec9139c8efa86cb3c842be58c324a13a19', now() - interval '28 days'),
('student', 'scrypt$85193595a0f03495bf3fa5280b5a6b96$7aa922d074212122cb93885d2e5317fa090f58bd5be0e5d3faa52889045519a5d18dc94605b796f7ca2de3919f1a8eec9139c8efa86cb3c842be58c324a13a19', now() - interval '5 days');

SELECT setseed(0.3208);

INSERT INTO quizzes (user_id, course, total, created_at)
SELECT u.id, CASE WHEN n % 2 = 0 THEN '9' ELSE '10' END, 10, now() - n * interval '52 hours'
FROM users u, generate_series(1, 12) n
WHERE u.username = 'demo';

INSERT INTO quiz_questions (quiz_id, position, question_id, question, answer, correct, expected)
WITH picked AS MATERIALIZED (
    SELECT z.id AS quiz_id, row_number() OVER (PARTITION BY z.id) AS position, p.*
    FROM quizzes z
    CROSS JOIN LATERAL (
        SELECT q.id, q.prompt, q.answer, q.answer_type,
               jsonb_build_object('id', q.id, 'prompt', q.prompt, 'answer_type', q.answer_type, 'difficulty', q.difficulty,
                                  'topic_id', t.id, 'topic_code', t.code, 'topic', t.name, 'unit', u.name, 'course', co.code) AS question
        FROM questions q
        JOIN topics t ON t.id = q.topic_id
        JOIN units u ON u.id = t.unit_id
        JOIN courses co ON co.id = u.course_id
        WHERE co.code = z.course
        ORDER BY random() LIMIT 10
    ) p
),

marked AS MATERIALIZED (
    SELECT *, random() < CASE WHEN answer_type IN ('expanded', 'factored', 'simplified', 'fraction') THEN 0.45 ELSE 0.85 END AS correct
    FROM picked
)
SELECT quiz_id, position, id, question,
       CASE WHEN correct THEN answer
            WHEN answer_type IN ('integer', 'decimal') AND answer ~ '^-?[0-9.]+$' THEN (answer::numeric + 1)::text
            WHEN answer_type IN ('expression', 'expanded', 'factored', 'simplified') THEN substring(prompt FROM '\$([^$]*)\$')
            ELSE '0' END,
       correct, answer
FROM marked;

UPDATE quizzes z SET submitted_at = z.created_at + interval '15 minutes',
                     correct = (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = z.id AND qq.correct);

UPDATE quiz_questions SET answer = NULL, correct = NULL, expected = NULL
WHERE quiz_id = (SELECT id FROM quizzes ORDER BY created_at DESC LIMIT 1);
UPDATE quizzes SET submitted_at = NULL, correct = NULL WHERE id = (SELECT id FROM quizzes ORDER BY created_at DESC LIMIT 1);

INSERT INTO attempts (user_id, question_id, quiz_id, answer, correct, created_at)
SELECT z.user_id, qq.question_id, z.id, qq.answer, qq.correct, z.submitted_at
FROM quiz_questions qq JOIN quizzes z ON z.id = qq.quiz_id
WHERE z.submitted_at IS NOT NULL;

INSERT INTO attempts (user_id, question_id, answer, correct, created_at)
WITH picked AS MATERIALIZED (
    SELECT u.id AS user_id, u.created_at AS joined, p.*
    FROM users u
    JOIN (VALUES ('demo', '8', 40), ('student', '7', 15)) v (username, course, count) ON v.username = u.username
    CROSS JOIN LATERAL (
        SELECT q.id, q.prompt, q.answer, q.answer_type
        FROM questions q
        JOIN topics t ON t.id = q.topic_id
        JOIN units un ON un.id = t.unit_id
        JOIN courses co ON co.id = un.course_id
        WHERE co.code = v.course
        ORDER BY random() LIMIT v.count
    ) p
),
marked AS MATERIALIZED (
    SELECT *, random() < 0.75 AS correct, now() - random() * (now() - joined) AS created_at FROM picked
)
SELECT user_id, id,
       CASE WHEN correct THEN answer
            WHEN answer_type IN ('integer', 'decimal') AND answer ~ '^-?[0-9.]+$' THEN (answer::numeric + 1)::text
            WHEN answer_type IN ('expression', 'expanded', 'factored', 'simplified') THEN substring(prompt FROM '\$([^$]*)\$')
            ELSE '0' END,
       correct, created_at
FROM marked;
