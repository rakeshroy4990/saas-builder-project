from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
import logging

from api.schemas import IngestHealthResponse, IngestResponse, IngestStatusResponse
from auth.dependencies import require_admin
from auth.models import TokenPayload
from config.settings import PDF_DIR
from ingestion.pdf_tracker import (
    get_unprocessed_pdfs,
    list_pdfs,
    registry_count_status,
    registry_count_total,
    registry_find_failed,
    registry_find_recent,
)
from workers.async_ingest_worker import process_all_pending

router = APIRouter()
log = logging.getLogger("pdf_rag.ingest")


@router.post("/ingest", response_model=IngestResponse, response_model_by_alias=True)
async def ingest(
    background_tasks: BackgroundTasks,
    pdf_dir: str = PDF_DIR,
    force: bool = False,
    user: TokenPayload = Depends(require_admin),
):
    all_pdfs = list_pdfs(pdf_dir)
    if not all_pdfs:
        raise HTTPException(
            status_code=400,
            detail=f"No PDF files found in pdf_dir='{pdf_dir}'. Add *.pdf files or fix PDF_DIR."
        )
    log.info("Ingest requested by sub=%s email=%s pdf_dir=%s force=%s", user.sub, user.email, pdf_dir, force)
    background_tasks.add_task(process_all_pending, pdf_dir, force)
    return IngestResponse(status="ingestion started", triggered_by=user.email)


@router.get("/ingest/status", response_model=IngestStatusResponse, response_model_by_alias=True)
async def ingest_status(
    pdf_dir: str = PDF_DIR,
    failed_limit: int = 10,
    recent_limit: int = 10,
    _: TokenPayload = Depends(require_admin),
):
    safe_limit = max(1, min(failed_limit, 100))
    safe_recent_limit = max(1, min(recent_limit, 100))

    failed_rows = registry_find_failed(safe_limit)
    failures = [
        {
            "file_hash": str(row.get("_id", "")),
            "filename": str(row.get("filename", "")),
            "filepath": str(row.get("filepath", "")),
            "error": str(row.get("error", "")),
        }
        for row in failed_rows
    ]

    recent_rows = registry_find_recent(safe_recent_limit)
    recent_files = [
        {
            "file_hash": str(row.get("_id", "")),
            "filename": str(row.get("filename", "")),
            "filepath": str(row.get("filepath", "")),
            "status": str(row.get("status", "")),
            "chunks_count": int(row.get("chunks_count", 0) or 0),
            "error": str(row.get("error", "") if row.get("error") is not None else ""),
            "prefilter_stats": row.get("prefilter_stats"),
        }
        for row in recent_rows
    ]

    return IngestStatusResponse(
        total_registry_records=registry_count_total(),
        processed=registry_count_status("processed"),
        processing=registry_count_status("processing"),
        failed=registry_count_status("failed"),
        pending_files=len(get_unprocessed_pdfs(pdf_dir)),
        recent_failures=failures,
        recent_files=recent_files,
    )


@router.get("/ingest/health", response_model=IngestHealthResponse, response_model_by_alias=True)
async def ingest_health(
    pdf_dir: str = PDF_DIR,
    _: TokenPayload = Depends(require_admin),
):
    return IngestHealthResponse(
        total_registry_records=registry_count_total(),
        processed=registry_count_status("processed"),
        processing=registry_count_status("processing"),
        failed=registry_count_status("failed"),
        pending_files=len(get_unprocessed_pdfs(pdf_dir)),
    )
