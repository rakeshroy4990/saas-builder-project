"""OpenAI text embeddings for pgvector retrieval."""
from __future__ import annotations

import logging
import time
from collections import OrderedDict
from typing import Optional

import httpx
from openai import OpenAI

from config.settings import EMBEDDING_DIMENSION, OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL
from query.rag_timing import log_timing

LOG = logging.getLogger(__name__)

_embedding_client: OpenAI | None = None
_EMBED_CACHE_MAX = 1000
_embed_cache: OrderedDict[str, tuple[float, ...]] = OrderedDict()


def _get_embedding_client() -> OpenAI:
    global _embedding_client
    if _embedding_client is None:
        _embedding_client = OpenAI(
            api_key=OPENAI_API_KEY,
            http_client=httpx.Client(
                limits=httpx.Limits(
                    max_connections=10,
                    max_keepalive_connections=5,
                    keepalive_expiry=30,
                )
            ),
        )
        LOG.info("[EMBED] singleton client created (_get_embedding_client)")
    return _embedding_client


def _cache_get(text: str) -> tuple[float, ...] | None:
    s = str(text or "").strip()
    if not s:
        return tuple()
    hit = _embed_cache.get(s)
    if hit is None:
        return None
    _embed_cache.move_to_end(s)
    return hit


def _cache_put(text: str, embedding: tuple[float, ...]) -> None:
    s = str(text or "").strip()
    if not s:
        return
    _embed_cache[s] = embedding
    _embed_cache.move_to_end(s)
    while len(_embed_cache) > _EMBED_CACHE_MAX:
        _embed_cache.popitem(last=False)


def get_embedding(text: str) -> list[float]:
    s = str(text or "").strip()
    if not s:
        return []
    client = _get_embedding_client()
    t_api = time.perf_counter()
    response = client.embeddings.create(
        model=OPENAI_EMBEDDING_MODEL,
        input=s,
        dimensions=EMBEDDING_DIMENSION,
    )
    api_ms = (time.perf_counter() - t_api) * 1000.0
    print(f"EMBED_OPENAI_MS={api_ms:.0f} client_singleton=True")
    return list(response.data[0].embedding)


def _embed_batch(inputs: list[str]) -> list[list[float]]:
    """Batch embed (ingest); uses the same singleton client as get_embedding."""
    if not inputs:
        return []
    out: list[list[float]] = []
    chunk_size = 64
    client = _get_embedding_client()
    for batch_start in range(0, len(inputs), chunk_size):
        sub = inputs[batch_start : batch_start + chunk_size]
        t_api = time.perf_counter()
        resp = client.embeddings.create(
            model=OPENAI_EMBEDDING_MODEL,
            input=sub,
            dimensions=EMBEDDING_DIMENSION,
        )
        api_ms = (time.perf_counter() - t_api) * 1000.0
        LOG.info(
            "[EMBED] batch model=%s dimensions=%s inputs=%s EMBED_OPENAI_MS=%.0f",
            OPENAI_EMBEDDING_MODEL,
            EMBEDDING_DIMENSION,
            len(sub),
            api_ms,
        )
        by_index = {d.index: list(d.embedding) for d in resp.data}
        for j in range(len(sub)):
            out.append(by_index.get(j, []))
    return out


def embed_query(text: str) -> list[float]:
    s = str(text or "").strip()
    if not s:
        return []
    cached = _cache_get(s)
    if cached is not None:
        log_timing("T3a_after_embed", cache="hit")
        return list(cached)
    vec = tuple(get_embedding(s))
    _cache_put(s, vec)
    log_timing("T3a_after_embed", cache="miss")
    return list(vec)


def embed_texts_same_order(texts: list[str]) -> list[list[float]]:
    """
    Returns one embedding list per input row (empty list when input is blank).
    Order matches `texts`. Uses LRU cache per string; batches only uncached texts.
    """
    placeholders: list[Optional[list[float]]] = [None] * len(texts)
    uncached: list[tuple[int, str]] = []

    for i, t in enumerate(texts):
        s = str(t or "").strip()
        if not s:
            continue
        hit = _cache_get(s)
        if hit is not None:
            placeholders[i] = list(hit)
        else:
            uncached.append((i, s))

    if uncached:
        batch_inputs = [s for _, s in uncached]
        vectors = _embed_batch(batch_inputs)
        for (orig_i, s), vec in zip(uncached, vectors):
            tup = tuple(vec) if vec else tuple()
            _cache_put(s, tup)
            placeholders[orig_i] = list(tup) if tup else []

    return [placeholders[i] if placeholders[i] is not None else [] for i in range(len(texts))]
