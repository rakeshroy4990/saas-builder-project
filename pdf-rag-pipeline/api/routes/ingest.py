from fastapi import APIRouter, BackgroundTasks, Depends

from auth.dependencies import require_admin
from auth.models import TokenPayload
from config.settings import PDF_DIR
from workers.async_ingest_worker import process_all_pending

router = APIRouter()


@router.post("/ingest")
async def ingest(
    background_tasks: BackgroundTasks,
    pdf_dir: str = PDF_DIR,
    user: TokenPayload = Depends(require_admin),
):
    background_tasks.add_task(process_all_pending, pdf_dir)
    return {"status": "ingestion started", "triggered_by": user.email}
