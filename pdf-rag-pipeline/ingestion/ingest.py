import logging
import re
import time
from contextlib import nullcontext
from datetime import datetime, timezone

from config.settings import is_postgres_persistence
from perf.perf_context import PERF_ENABLED, PerfTrace, finalize_perf, timed_span
from db.image_store import upload_image, delete_images_for_file
from ingestion.chunker import chunk_text as split_into_chunks
from ingestion.page_topic_classifier import classify_chapter_topic
from ingestion.pdf_extractor import extract_pages
from ingestion.pdf_tracker import compute_file_hash, mark_status
from ingestion.pre_filter.filter_pipeline import run_pre_filter
from query.audience_classifier import infer_source_audience

logger = logging.getLogger(__name__)


def _build_image_caption(img: dict, chapter_topic: str | None, page_num: int) -> str:
    parts = []
    if chapter_topic:
        parts.append(f"Figure related to: {chapter_topic}.")
    parts.append(f"Found on page {page_num + 1}.")
    bbox = img.get("bbox")
    if bbox:
        x0, y0, x1, y1 = bbox
        w, h = x1 - x0, y1 - y0
        ratio = w / h if h else 1
        if ratio > 2.5:
            parts.append("Wide figure — likely a timeline or comparison table.")
        elif ratio < 0.5:
            parts.append("Tall figure — likely a flowchart or architecture diagram.")
        else:
            parts.append("Square figure — likely a chart, graph, or illustration.")
    return " ".join(parts) if parts else f"Image on page {page_num + 1}."


def _interleave_text_and_images(
    page_text: str,
    page_images: list[dict],
    chapter_topic: str | None,
    orig_page: int,
) -> list[dict]:
    if not page_images:
        return [{"kind": "text", "content": page_text}]

    lines       = page_text.splitlines()
    total_lines = max(len(lines), 1)

    def image_line_position(img: dict) -> int:
        bbox = img.get("bbox")
        if not bbox:
            return total_lines
        _, y0, _, y1 = bbox
        mid_y       = (y0 + y1) / 2
        page_height = max(
            (im["bbox"][3] for im in page_images if im.get("bbox")), default=800
        )
        frac = mid_y / page_height
        return int(frac * total_lines)

    sorted_images = sorted(
        enumerate(page_images), key=lambda t: image_line_position(t[1])
    )

    blocks: list[dict] = []
    current_line = 0

    for img_index, img in sorted_images:
        insert_at = image_line_position(img)
        insert_at = max(current_line, min(insert_at, total_lines))

        text_before = "\n".join(lines[current_line:insert_at]).strip()
        if text_before:
            blocks.append({"kind": "text", "content": text_before})

        caption = _build_image_caption(img, chapter_topic, orig_page)

        blocks.append({
            "kind":        "image",
            "img_index":   img_index,
            "caption":     caption,
            "image_data":  img["data"],
            "image_ext":   img.get("ext", "png"),
            "image_bbox":  img.get("bbox"),
            "inline_marker": (
                f"\n\n[IMAGE:{img_index} | page={orig_page + 1} | ext={img.get('ext', 'png')} | {caption}]\n\n"
            ),
        })
        current_line = insert_at

    text_after = "\n".join(lines[current_line:]).strip()
    if text_after:
        blocks.append({"kind": "text", "content": text_after})

    return blocks


def _blocks_to_searchable_text(blocks: list[dict]) -> str:
    parts = []
    for block in blocks:
        if block["kind"] == "text":
            parts.append(block["content"])
        elif block["kind"] == "image":
            parts.append(block["inline_marker"])
    return "\n".join(parts).strip()


def _extract_image_refs_from_chunk(chunk_str: str) -> list[dict]:
    images = []
    pattern = re.compile(r'\[IMAGE:(\d+)\s*\|\s*page=(\d+)\s*\|\s*ext=([a-zA-Z0-9]+)\s*\|\s*([^\]]+)\]')
    for match in pattern.finditer(chunk_str):
        images.append({
            "img_index": int(match.group(1)),
            "page":      int(match.group(2)),
            "ext":       match.group(3).strip().lower() or "png",
            "caption":   match.group(4).strip(),
        })
    return images


def process_pdf(filepath: str, force: bool = False) -> dict | None:
    file_hash       = compute_file_hash(filepath)
    filename        = filepath.split("/")[-1]
    source_audience = infer_source_audience(filename)
    prefilter_stats: dict = {}

    trace = PerfTrace(operation="ingestion") if PERF_ENABLED else None
    wall_start = time.perf_counter() if PERF_ENABLED else None

    def span(name: str):
        return timed_span(trace, name) if trace is not None else nullcontext()

    mark_status(file_hash, "processing", filename=filename, filepath=filepath, error=None)
    delete_images_for_file(file_hash)

    try:
        with span("preprocess"):
            raw_pages, image_stats = extract_pages(filepath, include_diagnostics=True)
            clean_pages, prefilter_stats = run_pre_filter(raw_pages, source_file=filename)

            all_chunks: list[dict] = []

            for page_num, page in enumerate(clean_pages):
                if isinstance(page, str):
                    page = {"text": page, "images": [], "page_idx": page_num}

                page_text   = page.get("text", "").strip()
                page_images = page.get("images", [])
                orig_page   = page.get("page_idx", page_num)

                chapter_topic = classify_chapter_topic(page_text) if page_text else None

                blocks          = _interleave_text_and_images(page_text, page_images, chapter_topic, orig_page)
                searchable_text = _blocks_to_searchable_text(blocks)

                image_block_map: dict[int, dict] = {
                    b["img_index"]: b
                    for b in blocks
                    if b["kind"] == "image"
                }

                for chunk_index, chunk in enumerate(split_into_chunks(searchable_text)):
                    chunk_str           = chunk if isinstance(chunk, str) else chunk.get("text", "")
                    image_refs_in_chunk = _extract_image_refs_from_chunk(chunk_str)

                    uploaded_images = 0
                    for ref in image_refs_in_chunk:
                        idx   = ref["img_index"]
                        block = image_block_map.get(idx)
                        if block is None:
                            continue
                        url = upload_image(
                            file_hash   = file_hash,
                            page_num    = orig_page,
                            chunk_index = chunk_index,
                            img_index   = idx,
                            img_bytes   = block["image_data"],
                            ext         = block.get("image_ext", "png"),
                        )
                        if url:
                            uploaded_images += 1
                            image_stats["uploaded_total"] = int(image_stats.get("uploaded_total", 0)) + 1
                        else:
                            image_stats["upload_failed_total"] = int(image_stats.get("upload_failed_total", 0)) + 1

                    all_chunks.append({
                        "chunk_id":    f"{file_hash}_p{orig_page}_c{chunk_index}",
                        "type":        "mixed" if image_refs_in_chunk else "text",
                        "text":        chunk_str,
                        "has_images":  bool(image_refs_in_chunk),
                        "images_uploaded": uploaded_images,
                        "source_file": filename,
                        "file_hash":   file_hash,
                        "page_num":    orig_page,
                        "chunk_index": chunk_index,
                        "metadata": {
                            "chapter_topic": chapter_topic,
                            "audience":      source_audience,
                        },
                        "created_at":  datetime.now(timezone.utc),
                    })

            logger.info(f"[Ingest] {filename}: {len(all_chunks)} chunks built, persisting...")

        with span("db"):
            if is_postgres_persistence():
                from db import postgres_backend as pg
                pg.chunks_replace_for_file_hash(file_hash, all_chunks)
            else:
                from db.mongo_client import get_db
                db = get_db()
                db.chunks.delete_many({"file_hash": file_hash})
                if all_chunks:
                    db.chunks.insert_many(all_chunks)

        with span("embedding"):
            # Classic Mongo/Postgres text ingest has no separate embedding stage (Marker path uses workers).
            pass

        text_only = sum(1 for c in all_chunks if c["type"] == "text")
        mixed     = sum(1 for c in all_chunks if c["type"] == "mixed")
        image_stats["chunk_marked_image_total"] = mixed
        image_stats["text_only_chunk_total"] = text_only
        logger.info(
            "[Ingest][ImageStats] file=%s detected=%s kept=%s uploaded=%s upload_failed=%s dropped=%s reasons=%s",
            filename,
            image_stats.get("detected_total", 0),
            image_stats.get("kept_total", 0),
            image_stats.get("uploaded_total", 0),
            image_stats.get("upload_failed_total", 0),
            image_stats.get("dropped_total", 0),
            image_stats.get("dropped_reasons", {}),
        )

        mark_status(
            file_hash,
            "processed",
            chunks_count     = len(all_chunks),
            text_only_chunks = text_only,
            mixed_chunks     = mixed,
            ingested_at      = datetime.now(timezone.utc),
            prefilter_stats  = prefilter_stats,
            image_stats      = image_stats,
        )
        logger.info(f"[Ingest] {filename}: done. text={text_only} mixed={mixed}")
        return finalize_perf(trace, wall_start)

    except Exception as exc:
        if trace is not None and wall_start is not None:
            finalize_perf(trace, wall_start)
        mark_status(
            file_hash,
            "failed",
            error=str(exc),
            prefilter_stats=prefilter_stats,
            image_stats=locals().get("image_stats", {}),
        )
        raise
