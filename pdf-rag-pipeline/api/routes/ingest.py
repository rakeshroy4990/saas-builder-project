from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
import logging

from api.schemas import IngestHealthResponse, IngestResponse, IngestStatusResponse
from auth.dependencies import require_admin
from auth.models import TokenPayload
from config.settings import PDF_DIR
from db.mongo_client import get_db
from ingestion.pdf_tracker import get_unprocessed_pdfs, list_pdfs
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
    db = get_db()
    safe_limit = max(1, min(failed_limit, 100))
    safe_recent_limit = max(1, min(recent_limit, 100))

    failed_rows = list(
        db.pdf_registry.find({"status": "failed"}, {"_id": 1, "filename": 1, "filepath": 1, "error": 1})
        .sort("ingested_at", -1)
        .limit(safe_limit)
    )
    failures = [
        {
            "file_hash": str(row.get("_id", "")),
            "filename": str(row.get("filename", "")),
            "filepath": str(row.get("filepath", "")),
            "error": str(row.get("error", "")),
        }
        for row in failed_rows
    ]

    recent_rows = list(
        db.pdf_registry.find(
            {},
            {
                "_id": 1,
                "filename": 1,
                "filepath": 1,
                "status": 1,
                "chunks_count": 1,
                "error": 1,
                "prefilter_stats": 1,
                "ingested_at": 1,
            },
        )
        .sort("ingested_at", -1)
        .limit(safe_recent_limit)
    )
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
        total_registry_records=db.pdf_registry.count_documents({}),
        processed=db.pdf_registry.count_documents({"status": "processed"}),
        processing=db.pdf_registry.count_documents({"status": "processing"}),
        failed=db.pdf_registry.count_documents({"status": "failed"}),
        pending_files=len(get_unprocessed_pdfs(pdf_dir)),
        recent_failures=failures,
        recent_files=recent_files,
    )


@router.get("/ingest/health", response_model=IngestHealthResponse, response_model_by_alias=True)
async def ingest_health(
    pdf_dir: str = PDF_DIR,
    _: TokenPayload = Depends(require_admin),
):
    db = get_db()
    return IngestHealthResponse(
        total_registry_records=db.pdf_registry.count_documents({}),
        processed=db.pdf_registry.count_documents({"status": "processed"}),
        processing=db.pdf_registry.count_documents({"status": "processing"}),
        failed=db.pdf_registry.count_documents({"status": "failed"}),
        pending_files=len(get_unprocessed_pdfs(pdf_dir)),
    )
