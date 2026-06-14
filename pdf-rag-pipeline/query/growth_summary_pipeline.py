from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Callable, Optional

import httpx
from openai import OpenAI

from config.settings import OPENAI_API_KEY
from query.growth_characteristics import derive_growth_characteristics
from query.hyde import generate_hypothetical_answer

LOG = logging.getLogger(__name__)

GROWTH_SUMMARY_MODEL = "gpt-4o-mini"
GROWTH_TOP_K = 6
MIN_CHUNKS = 2
MAX_SUMMARY_WORDS = 40

_growth_client: OpenAI | None = None

GROWTH_SUMMARY_SYSTEM_PROMPT = (
    "You write one complete sentence for parents summarizing a child's growth measurement against WHO charts. "
    "Use plain language, at most 35 words, and end with proper punctuation. Do not diagnose or prescribe. "
    "Write the entire sentence in the Reply locale language — do not mix languages. "
    "When a growth profile phrase is provided, weave it naturally into the sentence in that same language. "
    "If weight and height percentiles are mostly typical (about 15–85), reassure briefly. "
    "If any percentile is below 3 or above 97, suggest discussing with the pediatrician — without alarm. "
    "Mention only measurements provided. Output plain text only — one sentence, no JSON."
)


def _get_client() -> OpenAI:
    global _growth_client
    if _growth_client is None:
        _growth_client = OpenAI(
            api_key=OPENAI_API_KEY,
            http_client=httpx.Client(
                limits=httpx.Limits(max_connections=4, max_keepalive_connections=2, keepalive_expiry=30)
            ),
        )
    return _growth_client


def _fmt_optional(value: Optional[float], suffix: str = "") -> str:
    if value is None:
        return ""
    try:
        num = float(value)
    except (TypeError, ValueError):
        return ""
    if suffix:
        return f"{num:g}{suffix}"
    return f"{num:g}"


def _fmt_percentile(value: Optional[float]) -> str:
    if value is None:
        return ""
    try:
        num = float(value)
    except (TypeError, ValueError):
        return ""
    return f"{round(num)}th percentile"


def build_growth_hyde_query(
    *,
    age_months: int,
    weight_kg: Optional[float],
    height_cm: Optional[float],
    head_circumference_cm: Optional[float],
    weight_percentile: Optional[float],
    height_percentile: Optional[float],
    bmi_percentile: Optional[float],
    hc_percentile: Optional[float],
) -> str:
    parts = [f"pediatric child age {max(0, int(age_months))} months WHO growth assessment"]
    if weight_kg is not None:
        w = _fmt_optional(weight_kg, " kg")
        wp = _fmt_percentile(weight_percentile)
        parts.append(f"weight {w}" + (f" ({wp})" if wp else ""))
    if height_cm is not None:
        h = _fmt_optional(height_cm, " cm")
        hp = _fmt_percentile(height_percentile)
        parts.append(f"height {h}" + (f" ({hp})" if hp else ""))
    if head_circumference_cm is not None:
        hc = _fmt_optional(head_circumference_cm, " cm head circumference")
        hcp = _fmt_percentile(hc_percentile)
        parts.append(hc + (f" ({hcp})" if hcp else ""))
    if bmi_percentile is not None:
        parts.append(f"BMI {_fmt_percentile(bmi_percentile)}")
    parts.append("interpretation for parents")
    return ", ".join(parts)


def _context_from_chunks(chunks: list[dict]) -> str:
    parts: list[str] = []
    for i, chunk in enumerate(chunks[:GROWTH_TOP_K], start=1):
        text = str(chunk.get("text") or chunk.get("content") or "").strip()
        if text:
            parts.append(f"[{i}] {text[:900]}")
    return "\n\n".join(parts)


def _band_label(percentile: Optional[float]) -> str:
    if percentile is None:
        return ""
    try:
        p = float(percentile)
    except (TypeError, ValueError):
        return ""
    if p < 3 or p > 97:
        return "worth a pediatrician check"
    if p < 15 or p > 85:
        return "slightly off typical"
    return "typical range"


def fallback_growth_summary(
    *,
    age_months: int,
    weight_kg: Optional[float],
    height_cm: Optional[float],
    head_circumference_cm: Optional[float],
    weight_percentile: Optional[float],
    height_percentile: Optional[float],
    bmi_percentile: Optional[float],
    hc_percentile: Optional[float],
) -> str:
    age = max(0, int(age_months))
    bits: list[str] = []
    if weight_kg is not None and weight_percentile is not None:
        bits.append(f"weight {_fmt_optional(weight_kg, ' kg')} ({_band_label(weight_percentile)})")
    elif weight_kg is not None:
        bits.append(f"weight {_fmt_optional(weight_kg, ' kg')} recorded")
    if height_cm is not None and height_percentile is not None:
        bits.append(f"height {_fmt_optional(height_cm, ' cm')} ({_band_label(height_percentile)})")
    elif height_cm is not None:
        bits.append(f"height {_fmt_optional(height_cm, ' cm')} recorded")
    if head_circumference_cm is not None:
        hc_band = _band_label(hc_percentile) if hc_percentile is not None else "recorded"
        bits.append(f"head size ({hc_band})")
    if not bits:
        return f"Growth reading at {age} months — discuss trends with your pediatrician."
    summary = f"At {age} months: " + ", ".join(bits) + "."
    if any(
        p is not None and (float(p) < 3 or float(p) > 97)
        for p in (weight_percentile, height_percentile, bmi_percentile, hc_percentile)
        if p is not None
    ):
        summary += " Consider sharing this visit with your doctor."
    return summary[:220]


def _trim_summary(text: str) -> str:
    clean = re.sub(r"\s+", " ", str(text or "").strip())
    if not clean:
        return ""
    if not clean.endswith((".", "!", "?")):
        clean = clean.rstrip(".,;:") + "."

    words = clean.split()
    if len(words) <= MAX_SUMMARY_WORDS:
        return clean

    truncated = " ".join(words[:MAX_SUMMARY_WORDS])
    for sep in (". ", "! ", "? ", "; "):
        idx = truncated.rfind(sep)
        if idx >= len(truncated) * 0.45:
            return truncated[: idx + 1].strip()

    truncated = truncated.rstrip(".,;:")
    if re.search(r"\b(with|your|the|a|an|and|or|to|for|about|please|discuss)\.?$", truncated, re.I):
        truncated = re.sub(
            r"\s+(with|your|the|a|an|and|or|to|for|about|please|discuss)\.?$",
            "",
            truncated,
            flags=re.I,
        ).rstrip(".,;:")
        if re.search(r"\b(discuss|share|review|check|mention)\b", truncated, re.I):
            truncated += " with your pediatrician."
        elif truncated and not truncated.endswith("."):
            truncated += "."

    if truncated and not truncated.endswith((".", "!", "?")):
        truncated += "."
    return truncated


def _parse_llm_summary_text(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return _trim_summary(str(parsed.get("Summary") or parsed.get("summary") or ""))
        except json.JSONDecodeError:
            pass
    return _trim_summary(text)


def _growth_summary_input(
    *,
    age_months: int,
    weight_kg: Optional[float],
    height_cm: Optional[float],
    head_circumference_cm: Optional[float],
    weight_percentile: Optional[float],
    height_percentile: Optional[float],
    bmi_percentile: Optional[float],
    hc_percentile: Optional[float],
    reply_locale: Optional[str],
    sex: Optional[str] = None,
) -> tuple[int, str, list[dict], str, dict[str, Any], str, dict[str, Any]]:
    age = max(0, int(age_months))
    has_measurement = any(v is not None for v in (weight_kg, height_cm, head_circumference_cm))
    if not has_measurement:
        raise ValueError("GROWTH_SUMMARY_MEASUREMENT_REQUIRED")

    hyde_query = build_growth_hyde_query(
        age_months=age,
        weight_kg=weight_kg,
        height_cm=height_cm,
        head_circumference_cm=head_circumference_cm,
        weight_percentile=weight_percentile,
        height_percentile=height_percentile,
        bmi_percentile=bmi_percentile,
        hc_percentile=hc_percentile,
    )

    chunks: list[dict] = []
    try:
        from query.retriever import retrieve

        hypothesis = generate_hypothetical_answer(hyde_query) or hyde_query
        chunks = retrieve(hypothesis, top_k=GROWTH_TOP_K, book_name=None, include_outdated_books=False)
    except Exception as exc:
        LOG.warning("[GROWTH][SUMMARY] retrieval_failed: %s", exc)

    locale = str(reply_locale or "en").strip().lower()[:2] or "en"
    characteristics = derive_growth_characteristics(
        sex=sex,
        weight_percentile=weight_percentile,
        height_percentile=height_percentile,
        bmi_percentile=bmi_percentile,
        hc_percentile=hc_percentile,
        reply_locale=locale,
    )
    measurement_blob = {
        "AgeMonths": age,
        "WeightKg": weight_kg,
        "HeightCm": height_cm,
        "HeadCircumferenceCm": head_circumference_cm,
        "WeightPercentile": weight_percentile,
        "HeightPercentile": height_percentile,
        "BmiPercentile": bmi_percentile,
        "HcPercentile": hc_percentile,
        "GrowthProfilePhrase": characteristics.get("Phrase"),
    }
    user_prompt = (
        f"Reply locale: {locale}\n"
        f"Growth profile: {characteristics.get('Phrase')}\n"
        f"Measurements JSON: {json.dumps(measurement_blob, ensure_ascii=False)}\n"
        f"Reference excerpts:\n{_context_from_chunks(chunks)}"
    )
    fallback = fallback_growth_summary(
        age_months=age,
        weight_kg=weight_kg,
        height_cm=height_cm,
        head_circumference_cm=head_circumference_cm,
        weight_percentile=weight_percentile,
        height_percentile=height_percentile,
        bmi_percentile=bmi_percentile,
        hc_percentile=hc_percentile,
    )
    return age, locale, chunks, user_prompt, measurement_blob, fallback, characteristics


def _call_growth_summary_llm(
    user_prompt: str,
    on_token: Callable[[str], None] | None = None,
) -> str:
    client = _get_client()
    messages = [
        {"role": "system", "content": GROWTH_SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    if on_token is not None:
        stream = client.chat.completions.create(
            model=GROWTH_SUMMARY_MODEL,
            temperature=0.2,
            max_tokens=120,
            messages=messages,
            stream=True,
        )
        parts: list[str] = []
        for chunk in stream:
            tok = str(chunk.choices[0].delta.content or "")
            if tok:
                parts.append(tok)
                on_token(tok)
        return _parse_llm_summary_text("".join(parts))
    response = client.chat.completions.create(
        model=GROWTH_SUMMARY_MODEL,
        temperature=0.2,
        max_tokens=120,
        messages=messages,
    )
    return _parse_llm_summary_text(str(response.choices[0].message.content or ""))


async def _emit_text_deltas(stream_queue: asyncio.Queue, text: str, *, step: int = 24) -> None:
    clean = _trim_summary(text)
    for i in range(0, max(len(clean), 1), step):
        chunk = clean[i : i + step] if clean else ""
        if chunk:
            await stream_queue.put(("delta", chunk))


def _complete_payload(
    summary: str,
    locale: str,
    model_used: str,
    characteristics: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "Summary": _trim_summary(summary),
        "ModelUsed": model_used,
        "ReplyLocale": locale,
    }
    if characteristics:
        payload["Characteristics"] = characteristics
    return payload


async def run_growth_history_summary_stream(
    *,
    age_months: int,
    weight_kg: Optional[float] = None,
    height_cm: Optional[float] = None,
    head_circumference_cm: Optional[float] = None,
    weight_percentile: Optional[float] = None,
    height_percentile: Optional[float] = None,
    bmi_percentile: Optional[float] = None,
    hc_percentile: Optional[float] = None,
    reply_locale: Optional[str] = None,
    sex: Optional[str] = None,
    stream_queue: asyncio.Queue,
) -> None:
    loop = asyncio.get_running_loop()
    t0 = time.perf_counter()
    try:
        age, locale, chunks, user_prompt, _measurement_blob, fallback, characteristics = _growth_summary_input(
            age_months=age_months,
            weight_kg=weight_kg,
            height_cm=height_cm,
            head_circumference_cm=head_circumference_cm,
            weight_percentile=weight_percentile,
            height_percentile=height_percentile,
            bmi_percentile=bmi_percentile,
            hc_percentile=hc_percentile,
            reply_locale=reply_locale,
            sex=sex,
        )

        await stream_queue.put(("status", {"phase": "hyde_hypothesis"}))

        if len(chunks) < MIN_CHUNKS or not OPENAI_API_KEY:
            await stream_queue.put(("status", {"phase": "generating"}))
            await _emit_text_deltas(stream_queue, fallback)
            await stream_queue.put(("complete", _complete_payload(fallback, locale, "fallback", characteristics)))
            LOG.info("[GROWTH][STREAM] fallback total_ms=%.0f", (time.perf_counter() - t0) * 1000)
            return

        await stream_queue.put(("status", {"phase": "generating"}))

        def on_token(tok: str) -> None:
            asyncio.run_coroutine_threadsafe(stream_queue.put(("delta", tok)), loop)

        def call_llm() -> str:
            try:
                return _call_growth_summary_llm(user_prompt, on_token=on_token)
            except Exception as exc:
                LOG.warning("[GROWTH][STREAM] llm_failed: %s", exc)
                return ""

        summary = await asyncio.to_thread(call_llm)
        if not summary:
            summary = fallback
            await _emit_text_deltas(stream_queue, summary)
        await stream_queue.put(("complete", _complete_payload(summary, locale, GROWTH_SUMMARY_MODEL, characteristics)))
        LOG.info("[GROWTH][STREAM] complete total_ms=%.0f", (time.perf_counter() - t0) * 1000)
    except ValueError as exc:
        await stream_queue.put(("error", {"message": str(exc)}))
    except Exception:
        LOG.exception("[GROWTH][STREAM] analyze_failed")
        await stream_queue.put(("error", {"message": "GROWTH_SUMMARY_UNAVAILABLE"}))


def summarize_growth_history(
    *,
    age_months: int,
    weight_kg: Optional[float] = None,
    height_cm: Optional[float] = None,
    head_circumference_cm: Optional[float] = None,
    weight_percentile: Optional[float] = None,
    height_percentile: Optional[float] = None,
    bmi_percentile: Optional[float] = None,
    hc_percentile: Optional[float] = None,
    reply_locale: Optional[str] = None,
    sex: Optional[str] = None,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    age, locale, chunks, user_prompt, _measurement_blob, fallback, characteristics = _growth_summary_input(
        age_months=age_months,
        weight_kg=weight_kg,
        height_cm=height_cm,
        head_circumference_cm=head_circumference_cm,
        weight_percentile=weight_percentile,
        height_percentile=height_percentile,
        bmi_percentile=bmi_percentile,
        hc_percentile=hc_percentile,
        reply_locale=reply_locale,
        sex=sex,
    )

    LOG.info(
        "[GROWTH][SUMMARY] hyde_context chunk_count=%s elapsed_ms=%.0f",
        len(chunks),
        (time.perf_counter() - t0) * 1000,
    )

    if len(chunks) < MIN_CHUNKS or not OPENAI_API_KEY:
        return {
            "Summary": _trim_summary(fallback),
            "ModelUsed": "fallback",
            "ReplyLocale": locale,
            "Characteristics": characteristics,
        }

    try:
        summary = _call_growth_summary_llm(user_prompt)
        if not summary:
            raise ValueError("empty_summary")
    except Exception as exc:
        LOG.warning("[GROWTH][SUMMARY] llm_failed: %s", exc)
        summary = fallback

    LOG.info("[GROWTH][SUMMARY] complete total_ms=%.0f", (time.perf_counter() - t0) * 1000)
    return {
        "Summary": _trim_summary(summary),
        "ModelUsed": GROWTH_SUMMARY_MODEL,
        "ReplyLocale": locale,
        "Characteristics": characteristics,
    }
