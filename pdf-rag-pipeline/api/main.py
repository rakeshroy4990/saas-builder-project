from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from api.routes import ingest, query
from cache.query_cache import ensure_cache_ttl_index
from config.settings import APP_LOG_LEVEL, CORS_ORIGINS
from db.text_search_index import ensure_text_index
from ingestion.pdf_tracker import ensure_registry_indexes

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
