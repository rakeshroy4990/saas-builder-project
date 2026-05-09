import logging
import os
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from config.settings import PDF_DIR
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from auth.dependencies import require_admin
from auth.models import TokenPayload
from ingestion.pdf_tracker import compute_file_hash, registry_find_recent, list_pdfs
from ingestion.ingest import process_pdf
from typing import Optional
logger = logging.getLogger(__name__)

router = APIRouter()


class IngestRequest(BaseModel):
    filepath: str


class IngestResponse(BaseModel):
    status: str
    triggered_by: str = ""
    message: str = ""
    file_hash: Optional[str] = None


@router.post("/ingest", response_model=IngestResponse, response_model_by_alias=True)
async def ingest(
    background_tasks: BackgroundTasks,
    filepath: str = PDF_DIR,
    force: bool = False,
    user: TokenPayload = Depends(require_admin),
):
    if os.path.isdir(filepath):
        # directory passed — process all PDFs in it
        all_pdfs = list_pdfs(filepath)
        if not all_pdfs:
            raise HTTPException(
                status_code=400,
                detail=f"No PDF files found in '{filepath}'."
            )
        for pdf in all_pdfs:
            background_tasks.add_task(process_pdf, pdf, force)  # was filepath, should be pdf
        message = f"Batch ingestion started for {len(all_pdfs)} PDFs in {filepath}"
    elif os.path.isfile(filepath):
        # single file passed
        background_tasks.add_task(process_pdf, filepath, force)
        message = f"Ingestion started for {filepath}"
    else:
        raise HTTPException(status_code=404, detail=f"Path not found: {filepath}")

    logger.info("Ingest requested by sub=%s email=%s filepath=%s force=%s", user.sub, user.email, filepath, force)

    return IngestResponse(
        status="ingestion started",
        triggered_by=user.email,
        message=message
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
