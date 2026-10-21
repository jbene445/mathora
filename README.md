# Mathora

- frontend/student: http://localhost:3000
- frontend/developer: http://localhost:3001
- backend/account: http://localhost:8007/docs
- backend/answer: http://localhost:8001/docs
- backend/curriculum: http://localhost:8002/docs
- backend/progress: http://localhost:8003/docs
- backend/question: http://localhost:8004/docs
- backend/quiz: http://localhost:8005/docs
- backend/solver: http://localhost:8006/docs
- database: localhost:5432

## Cloud

[Deploy CLI](DEPLOY.md)

[Deploy GUI](DEPLOY-VISUAL.md)

## Local

Run:

```bash
cd infrastructure
docker compose up -d
```

Example accounts (password mathora123):

- demo
- student

Rebuild:

```bash
docker compose up -d --build
docker compose restart student developer
```

Stop:

```bash
docker compose down
```

## AI Tool Usage Declaration

**AI/MT Tool:** ChatGPT

**Purpose of Use:**
I used ChatGPT as a coding assistant while completing this project. It helped write, test and debug code, set up Docker and Kubernetes, and draft documentation and diagrams.

**Prompts Used:**
I asked for help with the backend services, frontend, database, Docker, Kubernetes, Google Cloud deployment, error messages, documentation and code checking.

**Where the AI/MT Tool Was Used:**
AI was used across the project, including the backend, frontend, database, infrastructure files, documentation, diagrams and proposal draft.