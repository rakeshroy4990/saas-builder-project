import asyncio
import logging
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from api.schemas import (
    MarkerBookInfoRequest,
    MarkerBookInfoResponse,
    IngestResponse,
    MarkerIngestedBookPdfResponse,
    MarkerDeleteBookRequest,
    MarkerDeleteBookResponse,
    MarkerIngestRequest,
    MarkerIngestResponse,
)
from auth.dependencies import require_admin
from auth.models import TokenPayload
from config.settings import PDF_DIR, is_postgres_persistence
from db.image_store import delete_images_for_file
from ingestion.ingest import process_pdf
from ingestion.pdf_tracker import list_pdfs, registry_find_recent
from perf.perf_context import PERF_ENABLED

logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_pdf_under_pdf_dir(pdf_name: str) -> Path:
    raw = (pdf_name or "").strip().strip('"').strip("'")
    if not raw:
        raise HTTPException(status_code=400, detail="PdfName is required")
    root = Path(PDF_DIR)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail=f"PDF_DIR is not a directory: {PDF_DIR}")

    direct = root / raw
    if direct.is_file():
        return direct
    if not raw.lower().endswith(".pdf"):
        with_suffix = root / f"{raw}.pdf"
        if with_suffix.is_file():
            return with_suffix

    raw_l = raw.lower()
    pdfs = sorted(root.glob("*.pdf"), key=lambda p: p.name.lower())
    for p in pdfs:
        if p.stem.lower() == raw_l or p.name.lower() == raw_l:
            return p
    for p in pdfs:
        if raw_l in p.stem.lower():
            return p
    raise HTTPException(
        status_code=404,
        detail=f"No PDF matching {raw!r} under {root}",
    )


@router.post("/ingest", response_model=IngestResponse, response_model_by_alias=True)
async def ingest(
    background_tasks: BackgroundTasks,
    filepath: str = PDF_DIR,
    force: bool = False,
    perf_sync: bool = Query(
        default=False,
        description="When PERF_ENABLED and filepath is a single PDF, run ingest synchronously and return perf spans.",
    ),
    user: TokenPayload = Depends(require_admin),
):
    if os.path.isdir(filepath):
        all_pdfs = list_pdfs(filepath)
        if not all_pdfs:
            raise HTTPException(
                status_code=400,
                detail=f"No PDF files found in '{filepath}'.",
            )
        if PERF_ENABLED and perf_sync:
            raise HTTPException(
                status_code=400,
                detail="perf_sync is only supported when filepath points to a single PDF file.",
            )
        for pdf in all_pdfs:
            background_tasks.add_task(process_pdf, pdf, force)
        message = f"Batch ingestion started for {len(all_pdfs)} PDFs in {filepath}"
    elif os.path.isfile(filepath):
        if PERF_ENABLED and perf_sync:
            try:
                perf_data = await asyncio.to_thread(process_pdf, filepath, force)
            except Exception as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc
            logger.info(
                "Ingest (sync perf) completed by sub=%s email=%s filepath=%s force=%s",
                user.sub,
                user.email,
                filepath,
                force,
            )
            return IngestResponse(
                status="ingestion completed",
                triggered_by=user.email,
                message=f"Ingestion completed for {filepath}",
                perf=perf_data,
            )
        background_tasks.add_task(process_pdf, filepath, force)
        message = f"Ingestion started for {filepath}"
    else:
        raise HTTPException(status_code=404, detail=f"Path not found: {filepath}")

    logger.info("Ingest requested by sub=%s email=%s filepath=%s force=%s", user.sub, user.email, filepath, force)

    return IngestResponse(
        status="ingestion started",
        triggered_by=user.email,
        message=message,
    )


@router.post("/ingest/marker", response_model=MarkerIngestResponse, response_model_by_alias=True)
async def ingest_marker(
    background_tasks: BackgroundTasks,
    body: MarkerIngestRequest,
    user: TokenPayload = Depends(require_admin),
):
    """
    Queue Marker + embedding ingest for a PDF under ``PDF_DIR``.

    JSON body uses PascalCase keys: ``PdfName`` and ``BookName`` (required), optional ``BookStatus`` / ``Status``,
    optional ``PagesCsv``, optional ``Pages``.
    """
    if not is_postgres_persistence():
        raise HTTPException(
            status_code=400,
            detail="Marker vector ingest requires APP_PERSISTENCE_PROVIDER=postgres and DATABASE_URL.",
        )
    from ingestion.marker_worker import process_marker_job, schedule_marker_ingest

    path = _resolve_pdf_under_pdf_dir(body.pdf_name)
    try:
        summary = schedule_marker_ingest(
            str(path.resolve()),
            pages_query=body.pages,
            pages_csv=body.pages_csv,
            book_name=body.book_name,
            book_status=body.book_status,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"PDF not found: {path}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    job_id = int(summary["job_id"])
    background_tasks.add_task(process_marker_job, job_id)
    logger.info(
        "Marker ingest scheduled sub=%s email=%s job_id=%s file=%s",
        user.sub,
        user.email,
        job_id,
        path.name,
    )
    return MarkerIngestResponse(
        status="marker_ingest_started",
        triggered_by=user.email,
        job_id=int(summary["job_id"]),
        file_hash=str(summary["file_hash"]),
        total_pages=int(summary["total_pages"]),
        batch_count=int(summary["batch_count"]),
        batch_size=int(summary["batch_size"]),
        filepath=str(summary["filepath"]),
        filename=str(summary["filename"]),
        pages_queued_one_based=list(summary["pages_queued_one_based"]),
        pages_skipped_as_already_ingested_one_based=list(
            summary.get("pages_skipped_as_already_ingested_one_based") or []
        ),
        pages_explicitly_requested_one_based=list(
            summary.get("pages_explicitly_requested_one_based") or []
        ),
    )


@router.post("/ingest/marker/delete-book", response_model=MarkerDeleteBookResponse, response_model_by_alias=True)
async def delete_marker_book_data(
    body: MarkerDeleteBookRequest,
    user: TokenPayload = Depends(require_admin),
):
    """
    Delete all stored Marker ingest artifacts for one ``BookName`` so the book can be re-ingested cleanly.
    """
    if not is_postgres_persistence():
        raise HTTPException(
            status_code=400,
            detail="Marker book deletion requires APP_PERSISTENCE_PROVIDER=postgres and DATABASE_URL.",
        )
    from db import postgres_backend as pg

    try:
        summary = pg.purge_marker_book_data(body.book_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    image_objects_deleted = 0
    for file_hash in summary.get("file_hashes") or []:
        image_objects_deleted += int(delete_images_for_file(str(file_hash)))

    logger.info(
        "Marker book delete requested sub=%s email=%s book_name=%s files=%s",
        user.sub,
        user.email,
        summary.get("book_name"),
        summary.get("files_matched"),
    )
    return MarkerDeleteBookResponse(
        status="marker_book_data_deleted",
        triggered_by=user.email,
        book_name=str(summary.get("book_name") or ""),
        files_matched=int(summary.get("files_matched") or 0),
        file_hashes=list(summary.get("file_hashes") or []),
        rag_chunks_deleted=int(summary.get("rag_chunks_deleted") or 0),
        retrieval_items_deleted=int(summary.get("retrieval_items_deleted") or 0),
        marker_jobs_deleted=int(summary.get("marker_jobs_deleted") or 0),
        marker_batches_deleted=int(summary.get("marker_batches_deleted") or 0),
        registry_rows_deleted=int(summary.get("registry_rows_deleted") or 0),
        image_objects_deleted=image_objects_deleted,
    )


@router.get("/ingest/marker/books-pdfs", response_model=MarkerIngestedBookPdfResponse, response_model_by_alias=True)
async def list_marker_ingested_books_pdfs(
    user: TokenPayload = Depends(require_admin),
):
    """
    List all ingested ``BookName`` / ``PdfName`` pairs stored in the registry.
    """
    if not is_postgres_persistence():
        raise HTTPException(
            status_code=400,
            detail="Marker ingested books/pdf catalog requires APP_PERSISTENCE_PROVIDER=postgres and DATABASE_URL.",
        )
    from db import postgres_backend as pg

    rows = pg.pdf_registry_ingested_book_pdf_rows()
    logger.info(
        "Marker ingested books/pdfs requested sub=%s email=%s count=%s",
        user.sub,
        user.email,
        len(rows),
    )
    return MarkerIngestedBookPdfResponse(
        status="marker_ingested_books_pdfs_fetched",
        triggered_by=user.email,
        total_records=len(rows),
        items=rows,
    )


@router.post("/ingest/marker/book-info", response_model=MarkerBookInfoResponse, response_model_by_alias=True)
async def get_marker_book_info(
    body: MarkerBookInfoRequest,
    user: TokenPayload = Depends(require_admin),
):
    """
    Fetch all known Marker ingest details for one ``BookName``.
    """
    if not is_postgres_persistence():
        raise HTTPException(
            status_code=400,
            detail="Marker book info requires APP_PERSISTENCE_PROVIDER=postgres and DATABASE_URL.",
        )
    from db import postgres_backend as pg

    try:
        summary = pg.marker_book_info(body.book_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    logger.info(
        "Marker book info requested sub=%s email=%s book_name=%s files=%s",
        user.sub,
        user.email,
        summary.get("book_name"),
        summary.get("files_matched"),
    )
    return MarkerBookInfoResponse(
        status="marker_book_info_fetched",
        triggered_by=user.email,
        book_name=str(summary.get("book_name") or ""),
        files_matched=int(summary.get("files_matched") or 0),
        file_hashes=list(summary.get("file_hashes") or []),
        total_chunks=int(summary.get("total_chunks") or 0),
        retrieval_items_total=int(summary.get("retrieval_items_total") or 0),
        retrieval_text_items=int(summary.get("retrieval_text_items") or 0),
        retrieval_image_items=int(summary.get("retrieval_image_items") or 0),
        marker_jobs_total=int(summary.get("marker_jobs_total") or 0),
        marker_batches_total=int(summary.get("marker_batches_total") or 0),
        registry_rows=list(summary.get("registry_rows") or []),
        jobs=list(summary.get("jobs") or []),
        key_topics=list(summary.get("key_topics") or []),
    )


@router.get("/ingest/{file_hash}/status")
async def ingest_status(file_hash: str):
    recent = registry_find_recent(limit=100)
    match = next(
        (r for r in recent if r.get("file_hash") == file_hash or r.get("_id") == file_hash),
        None,
    )
    if match is None:
        raise HTTPException(status_code=404, detail="File hash not found")
    return match


@router.get("/ingest/{file_hash}/image-diagnostics")
async def ingest_image_diagnostics(file_hash: str):
    recent = registry_find_recent(limit=200)
    match = next(
        (r for r in recent if r.get("file_hash") == file_hash or r.get("_id") == file_hash),
        None,
    )
    if match is None:
        raise HTTPException(status_code=404, detail="File hash not found")
    return {
        "file_hash": file_hash,
        "filename": match.get("filename"),
        "filepath": match.get("filepath"),
        "status": match.get("status"),
        "image_stats": match.get("image_stats", {}),
        "prefilter_stats": match.get("prefilter_stats", {}),
        "ingested_at": match.get("ingested_at"),
    }
