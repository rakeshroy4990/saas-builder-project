"""
Dual-branch pgvector retrieval (text + image rows) for Marker-ingested content.
"""
from __future__ import annotations

import logging
from typing import Optional

from config.settings import (
    EMBEDDING_DIMENSION,
    MAX_CONTEXT_TOKENS,
    VECTOR_CONTEXT_MAX_TEXT_CHUNKS,
    VECTOR_TOP_K_IMAGE,
    VECTOR_TOP_K_TEXT,
)
from db import postgres_backend as pg
from query.embedding_service import embed_query
from query.token_utils import estimate_tokens

LOG = logging.getLogger(__name__)


def retrieve_vector_dual(
    query: str,
    chapter_topics: Optional[list[str]],
    audience: Optional[str],
) -> tuple[list[dict], list[dict]]:
    """Returns (text_hits, image_hits) with similarity scores."""
    qv = embed_query(query.strip())
    if len(qv) != EMBEDDING_DIMENSION:
        LOG.warning("[VectorRAG] empty or wrong-size query embedding")
        return [], []
    texts = pg.retrieval_vector_search(
        qv,
        "text",
        VECTOR_TOP_K_TEXT,
        chapter_topics=chapter_topics,
        audience=audience,
    )
    images = pg.retrieval_vector_search(
        qv,
        "image",
        VECTOR_TOP_K_IMAGE,
        chapter_topics=chapter_topics,
        audience=audience,
    )
    return texts, images


def build_llm_chunks_and_response_images(
    text_hits: list[dict],
    image_hits: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Build chunks shaped like FTS chunks for llm_service (text, source_file, page_num, metadata).
    Append a compact synthetic chunk summarizing top figures for the LLM.
    Returns (llm_chunks, images_for_api sorted by similarity desc).
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
        api_images.append({
            "url":        url,
            "caption":    str(row.get("content") or "").strip(),
            "similarity": float(row.get("similarity") or 0),
            "page_hint":  int(row.get("page_hint") or 0),
            "source_file": row.get("source_file", ""),
        })

    if sorted_images and api_images:
        lines = []
        for row in sorted_images[: min(5, len(sorted_images))]:
            cap = str(row.get("content") or "").strip()
            if cap:
                lines.append(f"[Figure ~PDF page {int(row.get('page_hint') or 0) + 1}] {cap[:700]}")
        merged = "\n".join(lines)
        if merged.strip():
            llm_chunks.append({
                "text":           merged,
                "source_file":    sorted_images[0].get("source_file", ""),
                "page_num":       int(sorted_images[0].get("page_hint") or 0),
                "metadata":       {"chapter_topic": None},
                "weighted_score": 0.5,
                "chunk_key":      "figure-context-summary",
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
