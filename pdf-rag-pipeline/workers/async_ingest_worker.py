import asyncio

from ingestion.ingest_pipeline import process_pdf
from ingestion.pdf_tracker import get_unprocessed_pdfs


async def process_all_pending(pdf_dir: str) -> None:
    pending = get_unprocessed_pdfs(pdf_dir)
    tasks = [asyncio.to_thread(process_pdf, path) for path in pending]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for path, result in zip(pending, results):
        if isinstance(result, Exception):
            print(f"[IngestError] {path}: {result}")
