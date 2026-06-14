from __future__ import annotations

import json
import logging
import re
from typing import Any

from config.settings import MULTILINGUAL_RESPONSE_MODEL, OPENAI_API_KEY, RAG_CHAT_MAX_COMPLETION_TOKENS
from query.i18n.registry import get_locale_config, normalize_locale_code

LOG = logging.getLogger(__name__)

_sync_openai_client = None
_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")


def _get_sync_client():
    global _sync_openai_client
    if _sync_openai_client is None:
        from openai import OpenAI

        _sync_openai_client = OpenAI(api_key=OPENAI_API_KEY or None)
    return _sync_openai_client


def build_multilingual_layman_prompt(
    query: str,
    chunks: list[dict],
    reply_locale: str,
) -> str:
    locale = normalize_locale_code(reply_locale)
    cfg = get_locale_config(locale)
    context = "\n\n".join(
        [f"[Source: {c['source_file']}, Page {c['page_num']}]\n{c['text']}" for c in chunks]
    )
    locale_block = cfg.reply_system_block or ""
    insufficient = cfg.insufficient_message
    return f"""You are Agastya, a pediatric health assistant for Agastya Healthcare. You help parents understand their child's health. You are NOT a doctor and cannot diagnose. Always recommend consulting a doctor for any health concern.

{locale_block}

If the question involves any emergency symptoms (difficulty breathing, seizure, high fever in infant, loss of consciousness), ALWAYS respond with: first the emergency instruction in the user's language, then 'Call 108 immediately' regardless of language.

Guidelines:
- Use simple, clear, non-technical language
- Be empathetic and supportive in tone
- Use ONLY the provided context; do not add external facts
- Do NOT provide definitive diagnosis

If information is insufficient, set answer to exactly: "{insufficient}"

Return strict JSON only (no markdown fences) with this shape:
{{
  "answer": "<main response in {locale} script>",
  "answer_english": "<English translation of answer, or same as answer if already English>",
  "follow_up_questions": ["<question 1>", "<question 2>"]
}}

CONTEXT:
{context}

QUESTION:
{query}

ANSWER:"""


def parse_multilingual_json(raw: str) -> dict[str, Any]:
    text = str(raw or "").strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = _JSON_BLOCK_RE.search(text)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return {"answer": text, "answer_english": None, "follow_up_questions": []}


def answer_multilingual_with_context(
    query: str,
    chunks: list[dict],
    reply_locale: str,
) -> dict[str, Any]:
    locale = normalize_locale_code(reply_locale)
    prompt = build_multilingual_layman_prompt(query, chunks, locale)
    model = (MULTILINGUAL_RESPONSE_MODEL or "").strip() or None

    if not OPENAI_API_KEY:
        LOG.warning("[i18n] OPENAI_API_KEY missing for multilingual answer")
        cfg = get_locale_config(locale)
        return {
            "answer": cfg.insufficient_message,
            "answer_english": cfg.insufficient_message,
            "follow_up_questions": [],
        }

    try:
        client = _get_sync_client()
        from config.settings import LLM_MODEL

        response = client.chat.completions.create(
            model=model or LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.35,
            max_tokens=RAG_CHAT_MAX_COMPLETION_TOKENS,
        )
        raw = (response.choices[0].message.content or "").strip()
        parsed = parse_multilingual_json(raw)
        answer = str(parsed.get("answer") or "").strip()
        answer_en = parsed.get("answer_english")
        answer_english = str(answer_en).strip() if answer_en else None
        follow_raw = parsed.get("follow_up_questions") or []
        follow_up = [str(x).strip() for x in follow_raw if str(x).strip()][:6]
        if not answer:
            cfg = get_locale_config(locale)
            answer = cfg.insufficient_message
        return {
            "answer": answer,
            "answer_english": answer_english,
            "follow_up_questions": follow_up,
        }
    except Exception:
        LOG.exception("[i18n] multilingual LLM failed locale=%s", locale)
        cfg = get_locale_config(locale)
        return {
            "answer": cfg.insufficient_message,
            "answer_english": cfg.insufficient_message,
            "follow_up_questions": [],
        }
