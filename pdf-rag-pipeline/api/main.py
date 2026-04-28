from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from api.routes import ingest, query
from cache.query_cache import ensure_cache_ttl_index
from config.settings import (
    APP_LOG_LEVEL,
    CORS_ORIGINS,
    SENTRY_DSN,
    SENTRY_ENABLED,
    SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE,
)
from db.text_search_index import ensure_text_index
from ingestion.pdf_tracker import ensure_registry_indexes

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


@app.on_event("startup")
async def startup() -> None:
    log_level = getattr(logging, APP_LOG_LEVEL, logging.INFO)
    logging.basicConfig(level=log_level, force=True)
    logging.getLogger("query").setLevel(log_level)
    logging.getLogger("api").setLevel(log_level)
    logging.getLogger("query.query_pipeline").setLevel(log_level)
    logging.getLogger("query.llm_service").setLevel(log_level)
    logging.getLogger("query.retriever").setLevel(log_level)
    logging.getLogger(__name__).info("Configured application log level: %s", APP_LOG_LEVEL)
    ensure_text_index()
    ensure_cache_ttl_index()
    ensure_registry_indexes()


app.include_router(query.router, prefix="/api/v1", tags=["Query"])
app.include_router(ingest.router, prefix="/api/v1", tags=["Ingest"])
