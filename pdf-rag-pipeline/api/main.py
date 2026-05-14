from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from api.routes import education, ingest, query
from cache.query_cache import ensure_cache_ttl_index
from config.settings import (
    APP_LOG_LEVEL,
    CORS_ORIGINS,
    MONGO_URI,
    SENTRY_DSN,
    SENTRY_ENABLED,
    SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE,
    is_postgres_persistence,
)
from db.text_search_index import ensure_text_index
from db.image_store import ensure_bucket_exists
from ingestion.pdf_tracker import ensure_registry_indexes
from perf.perf_context import PERF_ENABLED
from perf.perf_middleware import PerfMiddleware

if SENTRY_ENABLED and SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        integrations=[FastApiIntegration()],
        send_default_pii=False,
    )

app = FastAPI(title="PDF RAG Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

if PERF_ENABLED:
    app.add_middleware(PerfMiddleware)


@app.on_event("startup")
async def startup() -> None:
    log = logging.getLogger(__name__)
    log_level = getattr(logging, APP_LOG_LEVEL, logging.INFO)
    logging.basicConfig(level=log_level, force=True)
    logging.getLogger("query").setLevel(log_level)
    logging.getLogger("api").setLevel(log_level)
    logging.getLogger("query.query_pipeline").setLevel(log_level)
    logging.getLogger("query.llm_service").setLevel(log_level)
    logging.getLogger("query.retriever").setLevel(log_level)
    log.info("Configured application log level: %s", APP_LOG_LEVEL)
    if is_postgres_persistence():
        from db.postgres_backend import ensure_postgres_schema

        log.info("Startup: APP_PERSISTENCE_PROVIDER=postgres — ensuring schema (DATABASE_URL must be reachable)…")
        ensure_postgres_schema()
        log.info("Startup: checking Supabase S3 image bucket (SUPABASE_S3_* env)…")
        ensure_bucket_exists()
    else:
        log.info(
            "Startup: APP_PERSISTENCE_PROVIDER=mongo — ensuring indexes (%s must be reachable)…",
            MONGO_URI,
        )
        ensure_text_index()
        ensure_cache_ttl_index()
        ensure_registry_indexes()
    log.info("Startup: persistence hooks finished; API ready.")


app.include_router(query.router, prefix="/api/v1", tags=["Query"])
app.include_router(ingest.router, prefix="/api/v1", tags=["Ingest"])
app.include_router(education.router, prefix="/api/v1", tags=["Education"])
