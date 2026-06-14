from __future__ import annotations

import logging

from config.settings import OPENAI_API_KEY, TRANSLATION_CACHE_SIZE, TRANSLATION_MODEL
from query.i18n.registry import normalize_locale_code

LOG = logging.getLogger(__name__)

_sync_openai_client = None
_TRANSLATION_CACHE: dict[tuple[str, str], str] = {}


def _get_sync_client():
    global _sync_openai_client
    if _sync_openai_client is None:
        from openai import OpenAI

        _sync_openai_client = OpenAI(api_key=OPENAI_API_KEY or None)
    return _sync_openai_client


def _locale_label(code: str) -> str:
    labels = {"hi": "Hindi", "kn": "Kannada", "en": "English"}
    return labels.get(normalize_locale_code(code), "English")


def _call_openai_translate(text: str, source_locale: str) -> str:
    if not OPENAI_API_KEY:
        LOG.warning("[i18n] OPENAI_API_KEY missing; returning original text for translation")
        return text

    label = _locale_label(source_locale)
    system = (
        f"Translate the following {label} text to English. Return only the translation, "
        f"no explanation. Preserve medical terms. If the input contains romanized {label}, "
        f"first interpret it then translate."
    )
    try:
        client = _get_sync_client()
        response = client.chat.completions.create(
            model=TRANSLATION_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
            max_tokens=1200,
        )
        out = (response.choices[0].message.content or "").strip()
        return out or text
    except Exception:
        LOG.exception("[i18n] translation failed locale=%s", source_locale)
        return text


def translate_to_english(text: str, source_locale: str) -> str:
    source = normalize_locale_code(source_locale)
    body = str(text or "")
    if source == "en" or not body.strip():
        return body

    prefix = body[:200]
    cache_key = (prefix, source)
    cached = _TRANSLATION_CACHE.get(cache_key)
    if cached is not None:
        return cached

    translated = _call_openai_translate(body, source)
    if len(_TRANSLATION_CACHE) >= TRANSLATION_CACHE_SIZE and _TRANSLATION_CACHE:
        _TRANSLATION_CACHE.pop(next(iter(_TRANSLATION_CACHE)))
    _TRANSLATION_CACHE[cache_key] = translated
    return translated


def clear_translation_cache() -> None:
    _TRANSLATION_CACHE.clear()
