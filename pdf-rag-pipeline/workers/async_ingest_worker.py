import asyncio
import logging

from ingestion.ingest_pipeline import process_pdf
from ingestion.pdf_tracker import get_unprocessed_pdfs, list_pdfs

log = logging.getLogger("pdf_rag.ingest")


async def process_all_pending(pdf_dir: str, force: bool = False) -> None:
    pending = list_pdfs(pdf_dir) if force else get_unprocessed_pdfs(pdf_dir)
    log.info("Ingest scan complete. pdf_dir=%s force=%s pending=%s", pdf_dir, force, len(pending))
    if not pending:
        log.info("No pending PDFs found. Nothing to ingest.")
        return
    tasks = [asyncio.to_thread(process_pdf, path) for path in pending]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    success = 0
    failed = 0
    for path, result in zip(pending, results):
        if isinstance(result, Exception):
            failed += 1
            log.exception("Ingest failed for %s: %s", path, result)
        else:
            success += 1
            log.info("Ingest succeeded for %s", path)
    log.info("Ingest run finished. success=%s failed=%s", success, failed)
