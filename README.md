# Mathora

Run:

```bash
cd infrastructure
docker compose up -d
```

- frontend: http://localhost:3000
- backend/answer: http://localhost:8001/docs
- backend/curriculum: http://localhost:8002/docs
- backend/progress: http://localhost:8003/docs
- backend/question: http://localhost:8004/docs
- backend/quiz: http://localhost:8005/docs
- backend/solver: http://localhost:8006/docs
- database: localhost:5432

Stop:

```bash
docker compose down
```