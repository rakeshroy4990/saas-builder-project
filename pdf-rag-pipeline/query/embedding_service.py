"""OpenAI text embeddings for pgvector retrieval."""
from __future__ import annotations

import logging
from typing import Optional

from openai import OpenAI

from config.settings import EMBEDDING_DIMENSION, OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL

LOG = logging.getLogger(__name__)

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY or not OPENAI_API_KEY.strip():
            raise RuntimeError("OPENAI_API_KEY is required for embeddings")
        _client = OpenAI(api_key=OPENAI_API_KEY.strip())
    return _client


def embed_query(text: str) -> list[float]:
    vecs = embed_texts_same_order([text])
    return vecs[0] if vecs else []


def embed_texts_same_order(texts: list[str]) -> list[list[float]]:
    """
    Returns one embedding list per input row (empty list when input is blank).
    Order matches `texts`.
    """
    placeholders: list[Optional[list[float]]] = [None] * len(texts)
    indexed_batch: list[tuple[int, str]] = [
        (i, str(t).strip()) for i, t in enumerate(texts) if str(t or "").strip()
    ]
    if not indexed_batch:
        return [[] for _ in texts]

    client = _get_client()
    dim = EMBEDDING_DIMENSION
    chunk_size = 64
    for batch_start in range(0, len(indexed_batch), chunk_size):
        sub = indexed_batch[batch_start : batch_start + chunk_size]
        inputs = [t for _, t in sub]
        resp = client.embeddings.create(
            model=OPENAI_EMBEDDING_MODEL,
            input=inputs,
            dimensions=dim,
        )
        for d in resp.data:
            orig_i = sub[d.index][0]
            placeholders[orig_i] = list(d.embedding)

    return [placeholders[i] if placeholders[i] is not None else [] for i in range(len(texts))]
