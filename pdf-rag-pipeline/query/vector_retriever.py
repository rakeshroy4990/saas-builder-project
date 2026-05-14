"""
Dual-branch pgvector retrieval (text + image rows) for Marker-ingested content.

Marker ingest (see ``ingestion/marker_worker``) uploads each extracted figure to S3 and inserts a
``rag_retrieval_items`` row with ``kind='image'``. ``embedding_text`` is almost the same for every
figure (generic filename + page-range caption), so vector similarity does **not** encode figure
topic — we only surface figures whose PDF page sits near **text chunks actually used** in the LLM
context (``filter_api_images_by_selected_chunks``).
"""
from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from config.settings import (
    EMBEDDING_DIMENSION,
    IMAGE_CONTEXT_PAGE_WINDOW,
    MAX_CONTEXT_TOKENS,
    RAG_VECTOR_FETCH_IMAGE_ANN,
    VECTOR_CONTEXT_MAX_TEXT_CHUNKS,
    VECTOR_IMAGE_ANN_CANDIDATES,
    VECTOR_TOP_K_IMAGE,
    VECTOR_TOP_K_TEXT,
)
from db import postgres_backend as pg
from query.embedding_service import embed_query
from query.token_utils import estimate_tokens

LOG = logging.getLogger(__name__)

_VECTOR_IO_EXECUTOR = ThreadPoolExecutor(max_workers=6, thread_name_prefix="rag-vector-io")

_TITLE_STOP = frozenset(
    {"the", "of", "in", "for", "and", "or", "to", "a", "an", "on", "at", "with", "from"}
)


def _heading_phrase_bonus(query: str, content: str) -> float:
    """
    Boost cosine-ranked rows when the chunk body contains the query as a heading /
    phrase (section titles are often missed by embedding-only ranking).
    """
    ql = (query or "").strip().lower()
    cl = (content or "").lower()
    if len(ql) < 8 or not cl:
        return 0.0
    if ql in cl:
        return 0.22
    q_flat = re.sub(r"\s+", " ", ql)
    c_flat = re.sub(r"\s+", " ", cl)
    if q_flat in c_flat:
        return 0.22
    tokens = [t for t in re.findall(r"[a-z][a-z0-9]{2,}", ql) if t not in _TITLE_STOP]
    if len(tokens) < 2:
        return 0.0
    hits = sum(1 for t in tokens if t in cl)
    if hits == len(tokens):
        return 0.18
    if hits >= max(2, (len(tokens) + 1) // 2):
        return 0.10
    return 0.0


def filter_api_images_by_selected_chunks(
    api_images: list[dict],
    selected_chunks: list[dict],
    *,
    page_window: int | None = None,
    max_return: int | None = None,
) -> list[dict]:
    """
    Keep figures only when ``page_hint`` lies within ±window of a **selected** text chunk's
    ``page_num`` (0-based PDF index). Proximity to raw retrieval hits is too loose for textbooks.
    """
    if not api_images or not selected_chunks:
        return []
    win = IMAGE_CONTEXT_PAGE_WINDOW if page_window is None else max(0, int(page_window))
    mr = VECTOR_TOP_K_IMAGE if max_return is None else max(1, int(max_return))

    anchors: set[int] = set()
    for c in selected_chunks:
        if str(c.get("chunk_key") or "") == "figure-context-summary":
            continue
        anchors.add(int(c.get("page_num") or 0))

    if not anchors:
        return []

    def nearest_dist(ph: int) -> int:
        return min(abs(ph - a) for a in anchors)

    allowed: set[int] = set()
    for p in anchors:
        for d in range(-win, win + 1):
            if p + d >= 0:
                allowed.add(p + d)

    cand = [dict(x) for x in api_images if int(x.get("page_hint") or 0) in allowed]
    cand.sort(
        key=lambda x: (
            nearest_dist(int(x.get("page_hint") or 0)),
            -float(x.get("similarity") or 0),
        )
    )
    out = cand[:mr]
    if len(api_images) and not out:
        LOG.info(
            "[VectorRAG] dropped all %s figure candidates (none within ±%s pages of selected text)",
            len(api_images),
            win,
        )
    elif len(out) < len(api_images):
        LOG.info(
            "[VectorRAG] figures %s -> %s (context page filter ±%s)",
            len(api_images),
            len(out),
            win,
        )
    return out


def collect_page_local_images_for_selected_chunks(
    selected_chunks: list[dict],
    *,
    page_window: int | None = None,
    max_return: int | None = None,
) -> list[dict]:
    """
    Prefer figures stored near the selected text pages over ANN-ranked image candidates.

    Marker figure captions are often generic, so once the LLM text context is chosen we can
    fetch nearby figures directly from the same file(s) and return those to the API/UI.
    """
    if not selected_chunks:
        return []
    win = IMAGE_CONTEXT_PAGE_WINDOW if page_window is None else max(0, int(page_window))
    mr = VECTOR_TOP_K_IMAGE if max_return is None else max(1, int(max_return))
    anchors: list[tuple[str, int]] = []
    for chunk in selected_chunks:
        if str(chunk.get("chunk_key") or "") == "figure-context-summary":
            continue
        file_hash = str(chunk.get("file_hash") or "").strip()
        if not file_hash:
            continue
        anchors.append((file_hash, int(chunk.get("page_num") or 0)))
    if not anchors:
        return []

    page_local_rows = pg.retrieval_images_near_file_pages(anchors, page_window=win, limit=mr)
    out: list[dict] = []
    for row in page_local_rows:
        url = str(row.get("image_url") or "").strip()
        if not url:
            continue
        meta = row.get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        out.append(
            {
                "url": url,
                "caption": str(row.get("content") or "").strip(),
                "page_hint": int(row.get("page_hint") or 0),
                "source_file": row.get("source_file", ""),
                "file_hash": row.get("file_hash", ""),
                "page_preview_url": str(meta.get("page_preview_url") or "").strip(),
                "crop_suspect": bool(meta.get("crop_suspect")),
                "crop_suspect_reason": str(meta.get("crop_suspect_reason") or "").strip(),
            }
        )
    return out


def build_optional_figure_summary_chunk(api_images: list[dict]) -> Optional[dict]:
    """Compact chunk so the LLM sees only captions for figures we actually surface."""
    if not api_images:
        return None
    lines: list[str] = []
    first_sf = ""
    first_ph = 0
    for img in api_images[: min(4, len(api_images))]:
        ph = int(img.get("page_hint") or 0)
        cap = str(img.get("caption") or "").strip()
        first_sf = first_sf or str(img.get("source_file") or "")
        first_ph = ph
        if cap:
            lines.append(f"[Figure ~PDF page {ph + 1}] {cap[:520]}")
    merged = "\n".join(lines).strip()
    if not merged:
        return None
    return {
        "text": merged,
        "source_file": first_sf,
        "page_num": first_ph,
        "metadata": {"chapter_topic": None},
        "weighted_score": 0.45,
        "chunk_key": "figure-context-summary",
    }


def _rerank_text_hits_by_heading(query: str, rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for row in rows:
        r = dict(row)
        base = float(r.get("similarity") or 0)
        bonus = _heading_phrase_bonus(query, str(r.get("content") or ""))
        r["similarity"] = min(1.0, base + bonus)
        out.append(r)
    out.sort(key=lambda x: float(x.get("similarity") or 0), reverse=True)
    return out


def retrieve_vector_dual(
    query: str,
    chapter_topics: Optional[list[str]],
    audience: Optional[str],
    *,
    book_name: Optional[str] = None,
    include_outdated_books: bool = False,
) -> tuple[list[dict], list[dict]]:
    """Returns (text_hits, image_hits) with similarity scores."""
    qv = embed_query(query.strip())
    if len(qv) != EMBEDDING_DIMENSION:
        LOG.warning("[VectorRAG] empty or wrong-size query embedding")
        return [], []
    text_k = VECTOR_TOP_K_TEXT
    if str(book_name or "").strip():
        # Single-book queries need deeper candidate pools so the right section
        # is still inside the ANN shortlist after filtering.
        text_k = min(max(VECTOR_TOP_K_TEXT * 2, 48), 128)

    def _fetch_text() -> list[dict]:
        return pg.retrieval_vector_search(
            qv,
            "text",
            text_k,
            chapter_topics=chapter_topics,
            audience=audience,
            book_name=book_name,
            include_outdated_books=include_outdated_books,
        )

    fut_text = _VECTOR_IO_EXECUTOR.submit(_fetch_text)
    texts = fut_text.result()
    texts = _rerank_text_hits_by_heading(query, texts)

    if not RAG_VECTOR_FETCH_IMAGE_ANN:
        LOG.info("[VectorRAG] skipping image ANN (RAG_VECTOR_FETCH_IMAGE_ANN=false)")
        return texts, []

    image_pool_k = max(VECTOR_TOP_K_IMAGE, VECTOR_IMAGE_ANN_CANDIDATES)

    def _fetch_images() -> list[dict]:
        return pg.retrieval_vector_search(
            qv,
            "image",
            image_pool_k,
            chapter_topics=chapter_topics,
            audience=audience,
            book_name=book_name,
            include_outdated_books=include_outdated_books,
        )

    images = _VECTOR_IO_EXECUTOR.submit(_fetch_images).result()
    return texts, images


def build_llm_chunks_and_response_images(
    text_hits: list[dict],
    image_hits: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Build text chunks for the LLM from ``text_hits`` only.

    ``image_hits`` are converted to ``api_images`` (URL + caption pool). Do **not** inject a
    synthetic figure summary here — unrelated diagrams pollute answers; the query pipeline filters
    images to selected-context pages and optionally appends a short figure chunk afterward.
    """
    llm_chunks: list[dict] = []
    tokens_used = 0
    max_items = max(1, VECTOR_CONTEXT_MAX_TEXT_CHUNKS)

    for row in text_hits:
        body = str(row.get("content") or "").strip()
        if not body:
            continue
        t = estimate_tokens(body)
        if tokens_used + t > MAX_CONTEXT_TOKENS:
            break
        llm_chunks.append({
            "text":               body,
            "file_hash":          row.get("file_hash", ""),
            "source_file":        row.get("source_file", ""),
            "page_num":           int(row.get("page_hint") or 0),
            "metadata":           row.get("metadata") or {},
            "weighted_score":     float(row.get("similarity") or 0),
            "chunk_key":          row.get("chunk_key", ""),
            "vector_distance":    row.get("distance"),
        })
        tokens_used += t
        if len(llm_chunks) >= max_items:
            break

    sorted_images = sorted(
        image_hits,
        key=lambda r: float(r.get("similarity") or 0),
        reverse=True,
    )
    api_images: list[dict] = []
    for row in sorted_images:
        url = row.get("image_url") or ""
        if not url:
            continue
        meta = row.get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        api_images.append({
            "url":        url,
            "caption":    str(row.get("content") or "").strip(),
            "similarity": float(row.get("similarity") or 0),
            "page_hint":  int(row.get("page_hint") or 0),
            "source_file": row.get("source_file", ""),
            "file_hash": row.get("file_hash", ""),
            "page_preview_url": str(meta.get("page_preview_url") or "").strip(),
            "crop_suspect": bool(meta.get("crop_suspect")),
            "crop_suspect_reason": str(meta.get("crop_suspect_reason") or "").strip(),
        })

    return llm_chunks, api_images


def build_sources_payload(text_hits: list[dict], image_hits: list[dict]) -> list[dict]:
    sources: list[dict] = []
    seen: set[tuple[str, str, int]] = set()
    for row in text_hits:
        sf = str(row.get("source_file") or "")
        ph = int(row.get("page_hint") or 0)
        key = ("text", sf, ph)
        if key in seen:
            continue
        seen.add(key)
        sources.append({"kind": "text", "source_file": sf, "page": ph})
    for row in sorted(image_hits, key=lambda r: float(r.get("similarity") or 0), reverse=True):
        sf = str(row.get("source_file") or "")
        ph = int(row.get("page_hint") or 0)
        key = ("image", sf, ph)
        if key in seen:
            continue
        seen.add(key)
        sources.append({"kind": "image", "source_file": sf, "page": ph})
    return sources[:24]
