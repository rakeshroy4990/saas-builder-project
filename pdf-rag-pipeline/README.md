# PDF RAG Pipeline

FastAPI service for incremental PDF ingestion and query-time RAG using MongoDB `$text` search.

## Highlights

- JWT auth validated from Spring Boot-issued token (`HS256`/`RS256` compatible decode path).
- Incremental ingestion by file hash (`pdf_registry`).
- Pre-filter pipeline to drop noisy pages before chunking.
- MongoDB `$text` retrieval (no Atlas vector search required).
- Safety layer before LLM.
- Query cache with Mongo TTL.

## Run

1. Create venv and install dependencies.
2. Copy `.env.example` to `.env` and fill values.
3. Start API:

```bash
uvicorn api.main:app --reload --port 8090
```

## Endpoints

- `POST /api/v1/query` (auth required)
- `POST /api/v1/ingest` (admin role required)
