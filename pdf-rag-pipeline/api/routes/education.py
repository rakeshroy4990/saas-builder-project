"""Doctor Education catalog: books from registry + key topics from Marker ingest metadata."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas import EducationBooksResponse, EducationKeyTopicRow, EducationKeyTopicsResponse
from auth.dependencies import require_clinical_reader
from auth.models import TokenPayload
from config.settings import is_postgres_persistence
from db import postgres_backend as pg

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/education/books", response_model=EducationBooksResponse, response_model_by_alias=True)
async def list_education_books(
    include_outdated: bool = Query(False, alias="IncludeOutdated"),
    _user: TokenPayload = Depends(require_clinical_reader),
) -> EducationBooksResponse:
    if not is_postgres_persistence():
        raise HTTPException(
            status_code=400,
            detail="Education catalog requires APP_PERSISTENCE_PROVIDER=postgres",
        )
    books = pg.pdf_registry_distinct_book_names(active_only=not include_outdated)
    logger.info("[Education] books listed count=%s", len(books))
    return EducationBooksResponse(books=books)


@router.get("/education/key-topics", response_model=EducationKeyTopicsResponse, response_model_by_alias=True)
async def list_education_key_topics(
    book_name: Optional[str] = Query(None, alias="BookName", max_length=512),
    limit: int = Query(5, alias="Limit", ge=1, le=50),
    _user: TokenPayload = Depends(require_clinical_reader),
) -> EducationKeyTopicsResponse:
    if not is_postgres_persistence():
        raise HTTPException(
            status_code=400,
            detail="Education catalog requires APP_PERSISTENCE_PROVIDER=postgres",
        )
    bn = str(book_name).strip() if book_name else None
    rows = pg.education_top_key_topics(book_name=bn, limit=limit)
    topics = [EducationKeyTopicRow(label=r["label"], chunk_count=r["chunk_count"]) for r in rows]
    return EducationKeyTopicsResponse(key_topics=topics)
