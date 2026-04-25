from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import ingest, query
from cache.query_cache import ensure_cache_ttl_index
from db.text_search_index import ensure_text_index

app = FastAPI(title="PDF RAG Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.on_event("startup")
async def startup() -> None:
    ensure_text_index()
    ensure_cache_ttl_index()


app.include_router(query.router, prefix="/api/v1", tags=["Query"])
app.include_router(ingest.router, prefix="/api/v1", tags=["Ingest"])
