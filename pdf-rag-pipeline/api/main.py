from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import education, ingest, query, triage
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
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        integrations=[FastApiIntegration()],
        send_default_pii=False,
    )

_startup_ready = False
_startup_error: str | None = None


def _configure_logging() -> None:
    log = logging.getLogger(__name__)
    log_level = getattr(logging, APP_LOG_LEVEL, logging.INFO)
    logging.basicConfig(level=log_level, force=True)
    logging.getLogger("query").setLevel(log_level)
    logging.getLogger("api").setLevel(log_level)
    logging.getLogger("query.query_pipeline").setLevel(log_level)
    logging.getLogger("query.llm_service").setLevel(log_level)
    logging.getLogger("query.retriever").setLevel(log_level)
    log.info("Configured application log level: %s", APP_LOG_LEVEL)


def _run_blocking_startup() -> None:
    global _startup_ready, _startup_error
    log = logging.getLogger(__name__)
    try:
        if is_postgres_persistence():
            from db.postgres_backend import ensure_postgres_schema

            log.info(
                "Startup: APP_PERSISTENCE_PROVIDER=postgres — ensuring schema (DATABASE_URL must be reachable)…"
            )
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
        _startup_ready = True
        _startup_error = None
        log.info("Startup: persistence hooks finished; API ready.")
    except Exception as exc:
        _startup_ready = False
        _startup_error = str(exc)
        log.exception("Startup failed")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bind HTTP port immediately; run DB/S3 init in a background thread so Cloud Run startup probe passes."""
    _configure_logging()
    log = logging.getLogger(__name__)
    task = asyncio.create_task(asyncio.to_thread(_run_blocking_startup))

    def _on_startup_done(done: asyncio.Task) -> None:
        if done.cancelled():
            return
        exc = done.exception()
        if exc is not None:
            log.error("Background startup failed: %s", exc)

    task.add_done_callback(_on_startup_done)
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="PDF RAG Pipeline API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

if PERF_ENABLED:
    app.add_middleware(PerfMiddleware)


@app.get("/health")
async def health():
    if _startup_error:
        return JSONResponse(
            {"status": "degraded", "detail": "startup failed"},
            status_code=503,
        )
    if not _startup_ready:
        return {"status": "starting"}
    return {"status": "ok"}


app.include_router(query.router, prefix="/api/v1", tags=["Query"])
app.include_router(ingest.router, prefix="/api/v1", tags=["Ingest"])
app.include_router(education.router, prefix="/api/v1", tags=["Education"])
app.include_router(triage.router, prefix="/api/v1", tags=["Triage"])
