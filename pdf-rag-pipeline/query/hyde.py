from __future__ import annotations

import hashlib
import logging
from functools import lru_cache

import httpx
from openai import OpenAI

from config.settings import OPENAI_API_KEY

LOG = logging.getLogger(__name__)

HYDE_SYSTEM_PROMPT = (
    "You are drafting retrieval text for a medical knowledge search system. "
    "Write a concise, factual hypothetical answer in clinical textbook style. "
    "Do not include uncertainty disclaimers. Use medical terminology and avoid lay wording."
)

_hyde_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _hyde_client
    if _hyde_client is None:
        _hyde_client = OpenAI(
            api_key=OPENAI_API_KEY,
            http_client=httpx.Client(
                limits=httpx.Limits(
                    max_connections=6,
                    max_keepalive_connections=3,
                    keepalive_expiry=30,
                )
            ),
        )
    return _hyde_client


def _generate_hypothetical_answer_uncached(user_query: str) -> str:
    q = str(user_query or "").strip()
    if not q:
        return ""
    try:
        if not OPENAI_API_KEY:
            return q
        response = _get_client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            max_tokens=200,
            messages=[
                {"role": "system", "content": HYDE_SYSTEM_PROMPT},
                {"role": "user", "content": q},
            ],
        )
        hypothesis = str(response.choices[0].message.content or "").strip()
        if not hypothesis:
            return q
        if any(token in hypothesis.lower() for token in (" might ", " could ", " may ")):
            LOG.warning("[HyDE] speculative_language_detected")
        LOG.info("[HyDE] hypothesis_len=%s", len(hypothesis))
        return hypothesis
    except Exception as exc:
        LOG.warning("[HyDE] generation_failed_using_original_query: %s", exc)
        return q


@lru_cache(maxsize=500)
def _cached_hypothesis(query_hash: str, user_query: str) -> str:
    del query_hash
    return _generate_hypothetical_answer_uncached(user_query)


def get_hypothesis(user_query: str) -> str:
    clean_query = str(user_query or "").strip()
    if not clean_query:
        return ""
    normalized_query = clean_query.lower()
    query_hash = hashlib.md5(normalized_query.encode("utf-8")).hexdigest()
    return _cached_hypothesis(query_hash, normalized_query)


def generate_hypothetical_answer(user_query: str) -> str:
    return get_hypothesis(user_query)

