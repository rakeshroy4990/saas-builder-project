"""
Background Marker ingest: batched PDF slices → Marker → filters → S3 → embeddings → rag_retrieval_items.
"""
from __future__ import annotations

import json
import logging
import re
import tempfile
from typing import Optional
from datetime import datetime, timezone
from pathlib import Path

import fitz

from config.settings import EMBEDDING_DIMENSION, MARKER_FORCE_OCR
from db import postgres_backend as pg
from db.image_store import (
    delete_images_for_file,
    delete_marker_images_for_page_range,
    upload_marker_image,
    upload_marker_page_preview,
)
from ingestion.chunker import chunk_text
from ingestion.marker_pipeline import (
    convert_pdf_with_marker,
    extract_marker_image_description,
    extract_segment_figure_descriptions,
    extract_segment_heading,
    keep_marker_image,
    marker_image_crop_suspect,
    split_paginated_markdown,
    split_pdf_page_range,
)
from ingestion.page_topic_classifier import classify_chapter_topic
from ingestion.pdf_tracker import mark_status
from query.audience_classifier import infer_source_audience
from query.embedding_service import embed_texts_same_order

LOG = logging.getLogger(__name__)

_MARKER_IMAGE_REL_PAGE_RE = re.compile(r"(?:^|[_-])page[_-](\d+)(?:[_-]|$)", re.IGNORECASE)


def _marker_job_ingest_meta_dict(job: dict) -> dict:
    raw = job.get("ingest_meta")
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    if isinstance(raw, dict):
        return raw
    return {}


def _registry_book_kwargs_from_job(job: dict) -> dict[str, Optional[str]]:
    """Fields for pdf_registry_mark from job.ingest_meta (Marker POST body)."""
    meta = _marker_job_ingest_meta_dict(job)
    bn = str(meta.get("book_name") or "").strip() or None
    bs_raw = meta.get("book_status")
    bs: Optional[str] = None
    if isinstance(bs_raw, str) and bs_raw.strip():
        low = bs_raw.strip().lower()
        bs = "OutDated" if low == "outdated" else bs_raw.strip()
    kw: dict[str, Optional[str]] = {}
    if bn is not None:
        kw["book_name"] = bn
    if bs is not None:
        kw["book_status"] = bs
    return kw


def _merge_intervals(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not ranges:
        return []
    s = sorted((int(a), int(b)) for a, b in ranges)
    merged: list[list[int]] = [[s[0][0], s[0][1]]]
    for a, b in s[1:]:
        la, lb = merged[-1]
        if a <= lb + 1:
            merged[-1][1] = max(lb, b)
        else:
            merged.append([a, b])
    return [(x[0], x[1]) for x in merged]


def _covers_all_document_pages(merged: list[tuple[int, int]], total_pages: int) -> bool:
    if total_pages <= 0:
        return True
    want = set(range(total_pages))
    got: set[int] = set()
    for a, b in merged:
        got.update(range(a, b + 1))
    return got == want


def pages_csv_to_one_based(csv: str, total_pages: int) -> list[int]:
    out: set[int] = set()
    for part in csv.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            lo, hi = int(a.strip()), int(b.strip())
            if lo > hi:
                lo, hi = hi, lo
            for p in range(lo, hi + 1):
                if 1 <= p <= total_pages:
                    out.add(p)
        else:
            p = int(part)
            if 1 <= p <= total_pages:
                out.add(p)
    return sorted(out)


def merge_pages_query_params(
    pages: Optional[list[int]],
    pages_csv: Optional[str],
    total_pages: int,
) -> Optional[list[int]]:
    """
    Returns sorted unique 1-based page numbers, or None meaning 'all pages minus already-ingested'.
    """
    found: set[int] = set()
    if pages:
        for p in pages:
            pi = int(p)
            if 1 <= pi <= total_pages:
                found.add(pi)
    if pages_csv and str(pages_csv).strip():
        found.update(pages_csv_to_one_based(str(pages_csv).strip(), total_pages))
    if not found:
        return None
    return sorted(found)


def cluster_pages_to_batch_ranges(
    pages_zero_based_sorted: list[int],
    batch_size: int,
) -> list[tuple[int, int, int]]:
    """
    Build (batch_index, page_start, page_end) closed intervals from a sorted unique page list.
    Contiguous runs are split into slices of at most batch_size pages.
    """
    if not pages_zero_based_sorted:
        return []
    runs: list[tuple[int, int]] = []
    rs = pages_zero_based_sorted[0]
    re = pages_zero_based_sorted[0]
    for p in pages_zero_based_sorted[1:]:
        if p == re + 1:
            re = p
        else:
            runs.append((rs, re))
            rs, re = p, p
    runs.append((rs, re))

    ranges: list[tuple[int, int, int]] = []
    batch_idx = 0
    for a, b in runs:
        cur = a
        while cur <= b:
            end = min(cur + batch_size - 1, b)
            ranges.append((batch_idx, cur, end))
            batch_idx += 1
            cur = end + 1
    return ranges


def _absolute_page(batch_page_start: int, marker_rel_page: int) -> int:
    return int(batch_page_start) + int(marker_rel_page)


def _marker_image_page_hint(page_start: int, page_end: int, image_name: object) -> tuple[int, bool]:
    """
    Best-effort absolute PDF page for a Marker figure.

    Marker image ids commonly look like ``_page_10_Picture_7.jpeg`` where the page
    number is relative to the sliced batch PDF. If parsing fails, fall back to the
    batch start page to preserve previous behavior.
    """
    raw = str(image_name or "").strip()
    if raw:
        m = _MARKER_IMAGE_REL_PAGE_RE.search(raw)
        if m:
            try:
                abs_page = _absolute_page(page_start, int(m.group(1)))
            except (TypeError, ValueError):
                abs_page = page_start
            if page_start <= abs_page <= page_end:
                return abs_page, True
    return page_start, False


def _render_pdf_page_preview_bytes(doc: fitz.Document, page_index: int) -> bytes:
    page = doc.load_page(int(page_index))
    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
    return pix.tobytes("png")


def _build_marker_image_caption(
    *,
    filename: str,
    page_hint_img: int,
    image_name: object,
    page_hint_from_name: bool,
    page_start: int,
    page_end: int,
    image_description: str,
) -> str:
    if page_hint_from_name:
        base = (
            f"Medical textbook figure from {filename}. "
            f"Approximate PDF page {page_hint_img + 1}. Image id: {image_name}."
        )
    else:
        base = (
            f"Medical textbook figure from {filename}. "
            f"Original PDF pages ~{page_start + 1}–{page_end + 1}. Image id: {image_name}."
        )
    desc = str(image_description or "").strip()
    if desc:
        return f"{base} Description: {desc}"
    return base


def _page_linked_figure_description(
    page_descriptions: dict[int, list[str]],
    page_hint: int,
    page_image_ordinals: dict[int, int],
) -> str:
    descriptions = [str(x).strip() for x in (page_descriptions.get(page_hint) or []) if str(x).strip()]
    if not descriptions:
        return ""
    ordinal = int(page_image_ordinals.get(page_hint, 0))
    page_image_ordinals[page_hint] = ordinal + 1
    if len(descriptions) == 1:
        return descriptions[0]
    if ordinal < len(descriptions):
        return descriptions[ordinal]
    return descriptions[-1]


def _run_single_batch(
    filepath: str,
    file_hash: str,
    filename: str,
    source_audience: str,
    batch_row: dict,
    *,
    book_name: Optional[str] = None,
) -> dict:
    """Process one ingest batch row; return marker_stats summary."""
    batch_index = int(batch_row["batch_index"])
    page_start = int(batch_row["page_start"])
    page_end = int(batch_row["page_end"])
    stats: dict = {
        "text_segments": 0,
        "text_chunks_stored": 0,
        "images_detected": 0,
        "images_kept": 0,
        "images_uploaded": 0,
        "image_drop_reasons": {},
        "embedding_calls_strings": 0,
    }

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        slice_pdf = td_path / "slice.pdf"
        split_pdf_page_range(filepath, page_start, page_end, str(slice_pdf))
        probe = fitz.open(str(slice_pdf))
        page_ct = len(probe)
        probe.close()
        if page_ct == 0:
            stats["note"] = "empty_slice"
            return stats

        markdown, images_map, _marker_meta = convert_pdf_with_marker(
            slice_pdf,
            force_ocr=MARKER_FORCE_OCR,
            marker_output_base_dir=str(td_path.resolve()),
        )
        segments = split_paginated_markdown(markdown)
        stats["text_segments"] = len(segments)

        text_jobs: list[dict] = []
        image_jobs: list[dict] = []
        page_preview_url_cache: dict[int, str] = {}
        page_figure_descriptions: dict[int, list[str]] = {}
        page_image_ordinals: dict[int, int] = {}

        for seg_idx, (rel_page, segment) in enumerate(segments):
            abs_page = _absolute_page(page_start, rel_page)
            section_heading = extract_segment_heading(segment)
            figure_descriptions = extract_segment_figure_descriptions(segment)
            if figure_descriptions:
                page_figure_descriptions.setdefault(abs_page, []).extend(figure_descriptions)
            chunks = chunk_text(segment)
            if not chunks and segment.strip():
                chunks = [segment.strip()[:12_000]]
            for ci, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                topic = classify_chapter_topic(chunk)
                ck = f"t-p{abs_page}-s{seg_idx}-c{ci}"
                meta = {
                    "audience": source_audience,
                    "chapter_topic": topic,
                    "section_heading": section_heading,
                    "book_name": book_name,
                    "batch_index": batch_index,
                    "marker_rel_page": rel_page,
                    "segment_index": seg_idx,
                }
                text_jobs.append({
                    "kind": "text",
                    "file_hash": file_hash,
                    "source_file": filename,
                    "page_hint": abs_page,
                    "chunk_key": ck,
                    "content": chunk,
                    "embedding_text": f"{filename} page ~{abs_page + 1}. {chunk}",
                    "metadata": meta,
                })

        stats["images_detected"] = len(images_map)
        with fitz.open(str(filepath)) as source_doc:
            for seq_img, (name, img_path) in enumerate(images_map.items()):
                try:
                    dropped: dict[str, int] = {}
                    if not keep_marker_image(img_path, dropped):
                        for k, v in dropped.items():
                            stats["image_drop_reasons"][k] = stats["image_drop_reasons"].get(k, 0) + v
                        continue
                    stats["images_kept"] += 1
                    img_bytes = img_path.read_bytes()
                    ext = img_path.suffix.lstrip(".").lower() or "png"
                    page_hint_img, page_hint_from_name = _marker_image_page_hint(page_start, page_end, name)
                    crop_suspect, crop_reason = marker_image_crop_suspect(img_path)
                    image_description = extract_marker_image_description(img_path)
                    page_linked_description = _page_linked_figure_description(
                        page_figure_descriptions,
                        page_hint_img,
                        page_image_ordinals,
                    )
                    if not image_description:
                        image_description = page_linked_description

                    url = upload_marker_image(file_hash, batch_index, seq_img, page_hint_img, img_bytes, ext=ext)
                    if not url:
                        LOG.warning("[MarkerBatch] S3 upload failed for figure %s batch=%s", name, batch_index)
                        continue
                    stats["images_uploaded"] += 1

                    page_preview_url = page_preview_url_cache.get(page_hint_img, "")
                    if not page_preview_url:
                        try:
                            preview_bytes = _render_pdf_page_preview_bytes(source_doc, page_hint_img)
                            page_preview_url = (
                                upload_marker_page_preview(file_hash, page_hint_img, preview_bytes, ext="png") or ""
                            )
                        except Exception as exc:
                            LOG.warning(
                                "[MarkerBatch] page preview render/upload failed page=%s file=%s: %s",
                                page_hint_img,
                                filename,
                                exc,
                            )
                            page_preview_url = ""
                        if page_preview_url:
                            page_preview_url_cache[page_hint_img] = page_preview_url

                    caption = _build_marker_image_caption(
                        filename=filename,
                        page_hint_img=page_hint_img,
                        image_name=name,
                        page_hint_from_name=page_hint_from_name,
                        page_start=page_start,
                        page_end=page_end,
                        image_description=image_description,
                    )
                    ck_img = f"i-p{page_hint_img}-n{seq_img}"
                    meta_img = {
                        "audience": source_audience,
                        "chapter_topic": None,
                        "book_name": book_name,
                        "batch_index": batch_index,
                        "image_name": str(name),
                        "marker_rel_page": (page_hint_img - page_start) if page_hint_from_name else None,
                        "page_hint_source": "image_name" if page_hint_from_name else "batch_start_fallback",
                        "page_preview_url": page_preview_url,
                        "crop_suspect": crop_suspect,
                        "crop_suspect_reason": crop_reason,
                        "image_description": image_description,
                        "page_linked_description": page_linked_description,
                    }
                    image_jobs.append({
                        "kind": "image",
                        "file_hash": file_hash,
                        "source_file": filename,
                        "page_hint": page_hint_img,
                        "chunk_key": ck_img,
                        "content": caption,
                        "embedding_text": caption,
                        "image_url": url,
                        "image_storage_key": None,
                        "metadata": meta_img,
                    })
                finally:
                    try:
                        img_path.unlink(missing_ok=True)
                    except OSError:
                        pass

        jobs = text_jobs + image_jobs
        if not jobs:
            return stats

        strings = [j["embedding_text"] for j in jobs]
        stats["embedding_calls_strings"] = len(strings)
        vectors = embed_texts_same_order(strings)

        rows: list[dict] = []
        for job, vec in zip(jobs, vectors):
            if len(vec) != EMBEDDING_DIMENSION:
                LOG.warning("Skip chunk_key=%s bad embedding dim", job.get("chunk_key"))
                continue
            row = {
                "kind": job["kind"],
                "file_hash": job["file_hash"],
                "source_file": job["source_file"],
                "page_hint": job["page_hint"],
                "chunk_key": job["chunk_key"],
                "content": job["content"],
                "embedding_text": job["embedding_text"],
                "metadata": job["metadata"],
                "embedding": vec,
                "image_url": job.get("image_url"),
                "image_storage_key": job.get("image_storage_key"),
            }
            rows.append(row)

        pg.retrieval_items_insert_many(rows)
        stats["text_chunks_stored"] = sum(1 for r in rows if r["kind"] == "text")
        stats["images_vector_stored"] = sum(1 for r in rows if r["kind"] == "image")

    return stats


def process_marker_job(job_id: int) -> None:
    job = pg.marker_job_get_by_id(job_id)
    if not job:
        LOG.error("[MarkerJob] missing job id=%s", job_id)
        return

    file_hash = job["file_hash"]
    filepath = job["filepath"]
    filename = job["filename"]
    LOG.info("[MarkerJob] start id=%s file_hash=%s file=%s", job_id, file_hash, filename)

    book_kw = _registry_book_kwargs_from_job(job)
    mark_status(file_hash, "processing", filename=filename, filepath=filepath, error=None, **book_kw)
    pg.marker_job_update(job_id, "processing", error=None)

    batches = pg.marker_batches_for_job(job_id)
    batch_ranges = [(int(b["page_start"]), int(b["page_end"])) for b in batches]
    merged = _merge_intervals(batch_ranges)
    total_pages = int(job.get("total_pages") or 0)
    try:
        if _covers_all_document_pages(merged, total_pages):
            pg.retrieval_items_delete_for_file_hash(file_hash)
            delete_images_for_file(file_hash)
        else:
            pg.retrieval_items_delete_for_file_hash_page_ranges(file_hash, merged)
            for p0, p1 in merged:
                delete_marker_images_for_page_range(file_hash, p0, p1)
    except Exception as exc:
        LOG.warning("[MarkerJob] cleanup warning: %s", exc)

    source_audience = infer_source_audience(filename)
    meta_job = _marker_job_ingest_meta_dict(job)
    book_label = str(meta_job.get("book_name") or "").strip() or None
    failed_any = False
    last_error: str | None = None

    for b in batches:
        bid = int(b["id"])
        pg.marker_batch_update(bid, "processing", error=None, marker_stats=None)
        try:
            stats = _run_single_batch(
                filepath,
                file_hash,
                filename,
                source_audience,
                b,
                book_name=book_label,
            )
            pg.marker_batch_update(bid, "done", error=None, marker_stats=stats)
            LOG.info("[MarkerJob] batch id=%s index=%s done stats=%s", bid, b.get("batch_index"), stats)
        except Exception as exc:
            failed_any = True
            last_error = str(exc)
            LOG.exception("[MarkerJob] batch failed id=%s", bid)
            pg.marker_batch_update(bid, "failed", error=str(exc), marker_stats={"error": str(exc)})

    if failed_any:
        pg.marker_job_update(job_id, "failed", error=last_error or "batch_failure")
        mark_status(file_hash, "failed", filename=filename, filepath=filepath, error=last_error, **book_kw)
        return

    total_items = pg.retrieval_count_for_file_hash(file_hash)
    pg.marker_job_update(job_id, "completed", error=None)
    mark_status(
        file_hash,
        "processed",
        filename=filename,
        filepath=filepath,
        error=None,
        chunks_count=int(total_items),
        ingested_at=datetime.now(timezone.utc),
        **book_kw,
    )
    LOG.info("[MarkerJob] completed id=%s retrieval_items=%s", job_id, total_items)


def schedule_marker_ingest(
    filepath: str,
    pages_query: Optional[list[int]] = None,
    pages_csv: Optional[str] = None,
    *,
    book_name: str,
    book_status: Optional[str] = None,
) -> dict:
    """
    Create rag_marker_jobs row + rag_marker_batches rows for the Marker pipeline.
    Caller starts BackgroundTasks with process_marker_job(job_id).

    Optional page filters (1-based): repeat query param ``pages`` and/or ``pagesCsv`` like ``1,5-8``.
    When neither is set, pages already present in rag_retrieval_items are skipped.
    When a filter is set, those pages are always scheduled (refresh).
    """
    from config.settings import MARKER_BATCH_PAGES
    from ingestion.pdf_tracker import compute_file_hash

    path = Path(filepath)
    if not path.is_file():
        raise FileNotFoundError(filepath)

    file_hash = compute_file_hash(str(path))
    doc = fitz.open(str(path))
    total_pages = len(doc)
    doc.close()
    if total_pages < 1:
        raise ValueError("PDF has no pages")

    batch_size = MARKER_BATCH_PAGES

    explicit = merge_pages_query_params(pages_query, pages_csv, total_pages)

    bname = str(book_name or "").strip()
    if not bname:
        raise ValueError("book_name is required for Marker ingest")

    ingest_meta: dict = {
        "document_total_pages": total_pages,
        "pages_explicitly_requested_one_based": [],
        "pages_skipped_as_already_ingested_one_based": [],
        "book_name": bname,
        "book_status": book_status,
    }

    if explicit is not None:
        target_zero = sorted({p - 1 for p in explicit if 1 <= p <= total_pages})
        ingest_meta["pages_explicitly_requested_one_based"] = list(explicit)
    else:
        done = pg.retrieval_distinct_page_hints(file_hash)
        all_z = list(range(total_pages))
        target_zero = [p for p in all_z if p not in done]
        ingest_meta["pages_skipped_as_already_ingested_one_based"] = [p + 1 for p in sorted(done)]

    if not target_zero:
        raise ValueError(
            "No pages left to ingest for this PDF "
            "(already ingested, or empty selection)."
        )

    ranges = cluster_pages_to_batch_ranges(target_zero, batch_size)

    pages_queued_one_based = sorted({p + 1 for p in target_zero})
    ingest_meta["pages_queued_one_based"] = pages_queued_one_based

    jid = pg.marker_job_upsert_start(
        file_hash,
        str(path.resolve()),
        path.name,
        total_pages,
        batch_size,
        ingest_meta=ingest_meta,
    )
    pg.marker_batches_insert(jid, ranges)
    return {
        "job_id":       jid,
        "file_hash":    file_hash,
        "total_pages":  total_pages,
        "batch_count":  len(ranges),
        "batch_size":   batch_size,
        "filepath":     str(path.resolve()),
        "filename":     path.name,
        "pages_queued_one_based": pages_queued_one_based,
        "pages_skipped_as_already_ingested_one_based": ingest_meta.get(
            "pages_skipped_as_already_ingested_one_based", []
        ),
        "pages_explicitly_requested_one_based": ingest_meta.get(
            "pages_explicitly_requested_one_based", []
        ),
    }
