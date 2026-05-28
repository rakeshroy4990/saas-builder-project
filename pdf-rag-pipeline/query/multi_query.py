from __future__ import annotations

import logging

import httpx
from openai import OpenAI

from config.settings import OPENAI_API_KEY

LOG = logging.getLogger(__name__)

_multi_query_client: OpenAI | None = None

MULTI_QUERY_SYSTEM_PROMPT = (
    "Generate medical retrieval reformulations for a clinical RAG system. "
    "Return exactly two newline-separated queries and no numbering. "
    "Query 1 must be symptom or presentation focused. "
    "Query 2 must be pathophysiology or mechanism focused. "
    "Use textbook medical terminology."
)


def _get_client() -> OpenAI:
    global _multi_query_client
    if _multi_query_client is None:
        _multi_query_client = OpenAI(
            api_key=OPENAI_API_KEY,
            http_client=httpx.Client(
                limits=httpx.Limits(
                    max_connections=6,
                    max_keepalive_connections=3,
                    keepalive_expiry=30,
                )
            ),
        )
    return _multi_query_client


def _clean_variant_lines(raw: str) -> list[str]:
    lines: list[str] = []
    for line in str(raw or "").splitlines():
        cleaned = line.strip().lstrip("-").strip()
        if cleaned:
            lines.append(cleaned)
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(line)
    return out


def generate_query_variants(user_query: str, hypothetical_answer: str, n: int = 2) -> list[str]:
    query = str(user_query or "").strip()
    hypothesis = str(hypothetical_answer or "").strip()
    if not query:
        return []
    count = max(1, int(n))
    try:
        if not OPENAI_API_KEY:
            return [query]
        prompt = (
            "Original user question:\n"
            f"{query}\n\n"
            "Hypothetical medical answer:\n"
            f"{hypothesis or query}\n\n"
            "Generate exactly 2 retrieval query variants based on the hypothetical answer."
        )
        response = _get_client().chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=120,
            messages=[
                {"role": "system", "content": MULTI_QUERY_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        raw = str(response.choices[0].message.content or "").strip()
        variants = _clean_variant_lines(raw)[:count]
        if not variants:
            return [query]
        LOG.info("[MultiQuery] variants=%s", variants)
        return variants
    except Exception as exc:
        LOG.warning("[MultiQuery] generation_failed_using_single_query: %s", exc)
        return [query]

