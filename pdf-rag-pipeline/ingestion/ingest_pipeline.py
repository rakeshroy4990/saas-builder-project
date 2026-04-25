from datetime import datetime, timezone

from db.mongo_client import get_db
from ingestion.chunker import chunk_text
from ingestion.page_topic_classifier import classify_chapter_topic
from ingestion.pdf_extractor import extract_pages
from ingestion.pdf_tracker import compute_file_hash, mark_status
from ingestion.pre_filter.filter_pipeline import run_pre_filter
from query.audience_classifier import infer_source_audience


def process_pdf(filepath: str) -> None:
    file_hash = compute_file_hash(filepath)
    filename = filepath.split("/")[-1]
    source_audience = infer_source_audience(filename)
    mark_status(file_hash, "processing", filename=filename, filepath=filepath, error=None)
    prefilter_stats: dict = {}

    try:
        raw_pages = extract_pages(filepath)
        clean_pages, prefilter_stats = run_pre_filter(raw_pages, source_file=filename)

        all_chunks: list[dict] = []
        for page_num, page_text in enumerate(clean_pages):
            chapter_topic = classify_chapter_topic(page_text)
            for chunk_index, chunk in enumerate(chunk_text(page_text)):
                all_chunks.append(
                    {
                        "text": chunk,
                        "source_file": filename,
                        "file_hash": file_hash,
                        "page_num": page_num,
                        "chunk_index": chunk_index,
                        "metadata": {"chapter_topic": chapter_topic, "audience": source_audience},
                        "created_at": datetime.now(timezone.utc),
                    }
                )

        db = get_db()
        db.chunks.delete_many({"file_hash": file_hash})
        if all_chunks:
            db.chunks.insert_many(all_chunks)

        mark_status(
            file_hash,
            "processed",
            chunks_count=len(all_chunks),
            ingested_at=datetime.now(timezone.utc),
            prefilter_stats=prefilter_stats,
        )
    except Exception as exc:
        mark_status(file_hash, "failed", error=str(exc), prefilter_stats=prefilter_stats)
        raise
