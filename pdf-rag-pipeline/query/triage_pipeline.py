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
from query.hyde import generate_hypothetical_answer
from query.retriever import retrieve

LOG = logging.getLogger(__name__)

TRIAGE_MODEL = "gpt-4o-mini"
TRIAGE_TOP_K = 8
MIN_CHUNKS_FOR_CONFIDENT_TRIAGE = 3

INJECTION_PATTERNS = (
    re.compile(r"(?i)ignore\s+(all\s+)?(previous|prior)\s+instructions"),
    re.compile(r"(?i)system\s*:"),
    re.compile(r"(?i)you\s+are\s+now"),
    re.compile(r"(?i)jailbreak"),
)

EMERGENCY_SYMPTOM_TERMS = ("seizure", "convulsion", "breathing difficulty", "breathless", "not breathing")

LOW_CONFIDENCE_DISCLAIMER = (
    " Limited clinical reference data was available for this assessment; please treat this as preliminary guidance."
)

_triage_openai_client: OpenAI | None = None

TRIAGE_SYSTEM_PROMPT = (
    "You are a pediatric triage decision-support assistant. Use only the provided clinical reference excerpts. "
    "Do not diagnose or prescribe. Assess urgency for a parent-facing summary and a clinician pre-consultation note. "
    "Respond with a single JSON object only (no markdown) using these keys: "
    "UrgencyLevel (HOME_CARE|CLINIC_VISIT|EMERGENCY), UrgencyReasoning (parent-facing, 2-4 sentences), "
    "DoctorNote (concise clinical summary for the treating doctor), RedFlags (array of short strings, may be empty), "
    "Confidence (LOW|MEDIUM|HIGH)."
)


def _get_client() -> OpenAI:
    global _triage_openai_client
    if _triage_openai_client is None:
        _triage_openai_client = OpenAI(
            api_key=OPENAI_API_KEY,
            http_client=httpx.Client(
                limits=httpx.Limits(max_connections=4, max_keepalive_connections=2, keepalive_expiry=30)
            ),
        )
    return _triage_openai_client


def age_bucket(months: int) -> str:
    if months < 3:
        return "neonate"
    if months < 12:
        return "infant"
    if months < 60:
        return "toddler"
    return "child"


def sanitize_symptoms(raw: Optional[list[str]]) -> list[str]:
    if not raw:
        return []
    cleaned: list[str] = []
    for item in raw[:20]:
        text = re.sub(r"\s+", " ", str(item or "").strip())
        if not text:
            continue
        for pattern in INJECTION_PATTERNS:
            text = pattern.sub("", text).strip()
        if len(text) > 100:
            text = text[:100]
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def _symptoms_contain_emergency_terms(symptoms: list[str]) -> bool:
    blob = " ".join(symptoms).lower()
    return any(term in blob for term in EMERGENCY_SYMPTOM_TERMS)


def validate_triage_response(
    age_months: int,
    symptoms: list[str],
    payload: dict[str, Any],
) -> dict[str, Any]:
    urgency = str(payload.get("UrgencyLevel") or payload.get("urgency_level") or "CLINIC_VISIT").strip().upper()
    if urgency not in {"HOME_CARE", "CLINIC_VISIT", "EMERGENCY"}:
        urgency = "CLINIC_VISIT"

    reasoning = str(payload.get("UrgencyReasoning") or payload.get("urgency_reasoning") or "").strip()
    doctor_note = str(payload.get("DoctorNote") or payload.get("doctor_note") or "").strip()
    confidence = str(payload.get("Confidence") or payload.get("confidence") or "MEDIUM").strip().upper()
    if confidence not in {"LOW", "MEDIUM", "HIGH"}:
        confidence = "MEDIUM"

    red_flags_raw = payload.get("RedFlags") or payload.get("red_flags") or []
    red_flags: list[str] = []
    if isinstance(red_flags_raw, list):
        for flag in red_flags_raw:
            f = str(flag or "").strip()
            if f and f not in red_flags:
                red_flags.append(f[:120])

    if _symptoms_contain_emergency_terms(symptoms):
        urgency = "EMERGENCY"
        if not any("breath" in f.lower() or "seizure" in f.lower() for f in red_flags):
            red_flags.insert(0, "Emergency symptom reported")

    if age_months < 3 and urgency == "HOME_CARE":
        urgency = "CLINIC_VISIT"
        reasoning = (reasoning + " Neonates require in-person clinical assessment.").strip()

    if red_flags and urgency == "HOME_CARE":
        urgency = "CLINIC_VISIT"

    if confidence == "LOW" and LOW_CONFIDENCE_DISCLAIMER.strip() not in reasoning:
        reasoning = (reasoning + LOW_CONFIDENCE_DISCLAIMER).strip()

    if not reasoning:
        reasoning = "Please consult your pediatrician for further guidance."
    if not doctor_note:
        doctor_note = "Pre-consultation triage completed; review symptoms and urgency with the family."

    return {
        "UrgencyLevel": urgency,
        "UrgencyReasoning": reasoning,
        "DoctorNote": doctor_note,
        "RedFlags": red_flags,
        "Confidence": confidence,
    }


def _fallback_clinic_visit(reason: str) -> dict[str, Any]:
    return {
        "UrgencyLevel": "CLINIC_VISIT",
        "UrgencyReasoning": reason,
        "DoctorNote": "Automated triage fallback — limited reference data. Clinician review recommended.",
        "RedFlags": [],
        "Confidence": "LOW",
        "ModelUsed": TRIAGE_MODEL,
        "RagChunksUsed": [],
    }


def _build_hyde_query(age_months: int, symptoms: list[str]) -> str:
    symptom_text = ", ".join(symptoms) if symptoms else "unspecified symptoms"
    return f"pediatric patient age {age_months} months presenting with {symptom_text}"


def _chunks_to_rag_payload(chunks: list[dict]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for chunk in chunks:
        meta = chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
        out.append(
            {
                "BookName": str(meta.get("book_name") or chunk.get("book_name") or "").strip(),
                "Page": int(meta.get("page") or chunk.get("page") or 0),
                "Score": float(chunk.get("rrf_score") or chunk.get("score") or 0.0),
            }
        )
    return out


def _context_from_chunks(chunks: list[dict]) -> str:
    parts: list[str] = []
    for i, chunk in enumerate(chunks[:TRIAGE_TOP_K], start=1):
        text = str(chunk.get("text") or chunk.get("content") or "").strip()
        if text:
            parts.append(f"[{i}] {text[:1200]}")
    return "\n\n".join(parts)


async def _emit_stream_payload(stream_queue: asyncio.Queue, payload: dict) -> None:
    reasoning = str(payload.get("UrgencyReasoning") or payload.get("urgency_reasoning") or "")
    step = 80
    for i in range(0, max(len(reasoning), 1), step):
        chunk = reasoning[i : i + step] if reasoning else ""
        if chunk:
            await stream_queue.put(("delta", chunk))
        if i % (step * 4) == 0:
            await asyncio.sleep(0)
    await stream_queue.put(("complete", payload))


def _call_triage_llm(
    age_months: int,
    weight_kg: Optional[float],
    symptoms: list[str],
    duration_hours: Optional[int],
    severity: str,
    additional_notes: Optional[str],
    context: str,
    on_token: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    user_lines = [
        f"Child age: {age_months} months",
        f"Symptoms: {', '.join(symptoms)}",
        f"Severity: {severity}",
    ]
    if weight_kg is not None:
        user_lines.append(f"Weight kg: {weight_kg}")
    if duration_hours is not None:
        user_lines.append(f"Duration hours: {duration_hours}")
    if additional_notes:
        user_lines.append(f"Additional notes: {additional_notes[:500]}")
    if context:
        user_lines.append(f"Clinical reference excerpts:\n{context}")
    else:
        user_lines.append("Clinical reference excerpts: none retrieved")

    client = _get_client()
    messages = [
        {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(user_lines)},
    ]
    if on_token is not None:
        stream = client.chat.completions.create(
            model=TRIAGE_MODEL,
            temperature=0.1,
            max_tokens=700,
            response_format={"type": "json_object"},
            messages=messages,
            stream=True,
        )
        parts: list[str] = []
        for chunk in stream:
            tok = str(chunk.choices[0].delta.content or "")
            if tok:
                parts.append(tok)
                on_token(tok)
        raw = "".join(parts).strip() or "{}"
    else:
        response = client.chat.completions.create(
            model=TRIAGE_MODEL,
            temperature=0.1,
            max_tokens=700,
            response_format={"type": "json_object"},
            messages=messages,
        )
        raw = str(response.choices[0].message.content or "{}").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    return parsed


def analyze_triage(
    *,
    child_age_months: int,
    child_weight_kg: Optional[float],
    reported_symptoms: list[str],
    symptom_duration_hours: Optional[int],
    symptom_severity: str,
    additional_notes: Optional[str],
) -> dict[str, Any]:
    symptoms = sanitize_symptoms(reported_symptoms)
    if not symptoms:
        raise ValueError("TRIAGE_SYMPTOMS_REQUIRED")

    severity = str(symptom_severity or "").strip().upper()
    if severity not in {"MILD", "MODERATE", "SEVERE"}:
        raise ValueError("TRIAGE_SEVERITY_INVALID")

    age_months = max(0, int(child_age_months))
    t0 = time.perf_counter()
    LOG.info(
        "[TRIAGE] start age_bucket=%s symptom_count=%s severity=%s",
        age_bucket(age_months),
        len(symptoms),
        severity,
    )

    hyde_query = _build_hyde_query(age_months, symptoms)
    retrieve_t0 = time.perf_counter()
    try:
        hypothesis = generate_hypothetical_answer(hyde_query) or hyde_query
        hyde_ms = (time.perf_counter() - retrieve_t0) * 1000
        retrieve_t0 = time.perf_counter()
        chunks = retrieve(hypothesis, top_k=TRIAGE_TOP_K, book_name=None, include_outdated_books=False)
        retrieve_ms = (time.perf_counter() - retrieve_t0) * 1000
        LOG.info(
            "[TRIAGE][TIMING] hyde_ms=%.0f retrieve_ms=%.0f chunk_count=%s",
            hyde_ms,
            retrieve_ms,
            len(chunks),
        )
    except Exception as exc:
        LOG.warning("[TRIAGE] retrieval_failed: %s elapsed_ms=%.0f", exc.__class__.__name__, (time.perf_counter() - t0) * 1000)
        chunks = []

    rag_payload = _chunks_to_rag_payload(chunks)
    if len(chunks) < MIN_CHUNKS_FOR_CONFIDENT_TRIAGE:
        result = _fallback_clinic_visit(
            "We could not retrieve enough clinical reference material for a confident home-care recommendation. "
            "Please arrange a clinic visit or contact your pediatrician."
        )
        result["RagChunksUsed"] = rag_payload
        LOG.info("[TRIAGE][TIMING] fallback_after_retrieve total_ms=%.0f", (time.perf_counter() - t0) * 1000)
        return result

    llm_t0 = time.perf_counter()
    try:
        llm_raw = _call_triage_llm(
            age_months,
            child_weight_kg,
            symptoms,
            symptom_duration_hours,
            severity,
            additional_notes,
            _context_from_chunks(chunks),
        )
    except Exception as exc:
        LOG.warning("[TRIAGE] llm_failed: %s llm_ms=%.0f", exc.__class__.__name__, (time.perf_counter() - llm_t0) * 1000)
        result = _fallback_clinic_visit(
            "Triage analysis is temporarily unavailable. Please consult a pediatrician or visit a clinic."
        )
        result["RagChunksUsed"] = rag_payload
        LOG.info("[TRIAGE][TIMING] fallback_after_llm total_ms=%.0f", (time.perf_counter() - t0) * 1000)
        return result

    llm_ms = (time.perf_counter() - llm_t0) * 1000
    validated = validate_triage_response(age_months, symptoms, llm_raw)
    validated["ModelUsed"] = TRIAGE_MODEL
    validated["RagChunksUsed"] = rag_payload
    LOG.info(
        "[TRIAGE][TIMING] llm_ms=%.0f total_ms=%.0f urgency=%s confidence=%s",
        llm_ms,
        (time.perf_counter() - t0) * 1000,
        validated.get("UrgencyLevel"),
        validated.get("Confidence"),
    )
    return validated


async def run_analyze_triage_stream(
    *,
    child_age_months: int,
    child_weight_kg: Optional[float],
    reported_symptoms: list[str],
    symptom_duration_hours: Optional[int],
    symptom_severity: str,
    additional_notes: Optional[str],
    stream_queue: asyncio.Queue,
) -> None:
    loop = asyncio.get_running_loop()
    t0 = time.perf_counter()
    try:
        symptoms = sanitize_symptoms(reported_symptoms)
        if not symptoms:
            raise ValueError("TRIAGE_SYMPTOMS_REQUIRED")

        severity = str(symptom_severity or "").strip().upper()
        if severity not in {"MILD", "MODERATE", "SEVERE"}:
            raise ValueError("TRIAGE_SEVERITY_INVALID")

        age_months = max(0, int(child_age_months))
        LOG.info(
            "[TRIAGE][STREAM] start age_bucket=%s symptom_count=%s severity=%s",
            age_bucket(age_months),
            len(symptoms),
            severity,
        )

        await stream_queue.put(("status", {"phase": "retrieving"}))
        LOG.info("[TRIAGE][STREAM][TIMING] status_retrieving_ms=%.0f", (time.perf_counter() - t0) * 1000)

        hyde_query = _build_hyde_query(age_months, symptoms)

        await stream_queue.put(("status", {"phase": "hyde_hypothesis"}))
        LOG.info("[TRIAGE][STREAM][TIMING] status_hyde_ms=%.0f", (time.perf_counter() - t0) * 1000)

        def run_hyde() -> str:
            hyde_t0 = time.perf_counter()
            try:
                hypothesis = generate_hypothetical_answer(hyde_query) or hyde_query
                LOG.info("[TRIAGE][STREAM][TIMING] hyde_ms=%.0f", (time.perf_counter() - hyde_t0) * 1000)
                return hypothesis
            except Exception as exc:
                LOG.warning(
                    "[TRIAGE][STREAM] hyde_failed: %s hyde_ms=%.0f",
                    exc.__class__.__name__,
                    (time.perf_counter() - hyde_t0) * 1000,
                )
                return hyde_query

        hypothesis = await asyncio.to_thread(run_hyde)

        await stream_queue.put(("status", {"phase": "retrieving_docs"}))
        LOG.info("[TRIAGE][STREAM][TIMING] status_retrieving_docs_ms=%.0f", (time.perf_counter() - t0) * 1000)

        def run_retrieve(hypothesis_text: str) -> tuple[list[dict], list[dict[str, Any]]]:
            retrieve_t0 = time.perf_counter()
            try:
                chunks = retrieve(
                    hypothesis_text,
                    top_k=TRIAGE_TOP_K,
                    book_name=None,
                    include_outdated_books=False,
                )
                LOG.info(
                    "[TRIAGE][STREAM][TIMING] retrieve_ms=%.0f chunk_count=%s retrieve_total_ms=%.0f",
                    (time.perf_counter() - retrieve_t0) * 1000,
                    len(chunks),
                    (time.perf_counter() - retrieve_t0) * 1000,
                )
            except Exception as exc:
                LOG.warning(
                    "[TRIAGE][STREAM] retrieval_failed: %s retrieve_ms=%.0f",
                    exc.__class__.__name__,
                    (time.perf_counter() - retrieve_t0) * 1000,
                )
                chunks = []
            return chunks, _chunks_to_rag_payload(chunks)

        chunks, rag_payload = await asyncio.to_thread(run_retrieve, hypothesis)
        LOG.info("[TRIAGE][STREAM][TIMING] retrieval_complete_ms=%.0f", (time.perf_counter() - t0) * 1000)

        if len(chunks) < MIN_CHUNKS_FOR_CONFIDENT_TRIAGE:
            result = _fallback_clinic_visit(
                "We could not retrieve enough clinical reference material for a confident home-care recommendation. "
                "Please arrange a clinic visit or contact your pediatrician."
            )
            result["RagChunksUsed"] = rag_payload
            await _emit_stream_payload(stream_queue, result)
            LOG.info("[TRIAGE][STREAM][TIMING] fallback_after_retrieve total_ms=%.0f", (time.perf_counter() - t0) * 1000)
            return

        await stream_queue.put(("status", {"phase": "generating"}))
        LOG.info("[TRIAGE][STREAM][TIMING] status_generating_ms=%.0f", (time.perf_counter() - t0) * 1000)

        first_token_logged = False

        def on_token(tok: str) -> None:
            nonlocal first_token_logged
            if not first_token_logged:
                first_token_logged = True
                LOG.info("[TRIAGE][STREAM][TIMING] first_token_ms=%.0f", (time.perf_counter() - t0) * 1000)
            asyncio.run_coroutine_threadsafe(stream_queue.put(("delta", tok)), loop)

        def call_llm() -> dict[str, Any]:
            llm_t0 = time.perf_counter()
            try:
                parsed = _call_triage_llm(
                    age_months,
                    child_weight_kg,
                    symptoms,
                    symptom_duration_hours,
                    severity,
                    additional_notes,
                    _context_from_chunks(chunks),
                    on_token=on_token,
                )
                LOG.info("[TRIAGE][STREAM][TIMING] llm_ms=%.0f", (time.perf_counter() - llm_t0) * 1000)
                return parsed
            except Exception as exc:
                LOG.warning(
                    "[TRIAGE][STREAM] llm_failed: %s llm_ms=%.0f",
                    exc.__class__.__name__,
                    (time.perf_counter() - llm_t0) * 1000,
                )
                return {}

        llm_raw = await asyncio.to_thread(call_llm)
        if not llm_raw:
            result = _fallback_clinic_visit(
                "Triage analysis is temporarily unavailable. Please consult a pediatrician or visit a clinic."
            )
            result["RagChunksUsed"] = rag_payload
            await _emit_stream_payload(stream_queue, result)
            LOG.info("[TRIAGE][STREAM][TIMING] fallback_after_llm total_ms=%.0f", (time.perf_counter() - t0) * 1000)
            return

        validated = validate_triage_response(age_months, symptoms, llm_raw)
        validated["ModelUsed"] = TRIAGE_MODEL
        validated["RagChunksUsed"] = rag_payload
        await stream_queue.put(("complete", validated))
        LOG.info(
            "[TRIAGE][STREAM][TIMING] complete_ms=%.0f urgency=%s confidence=%s",
            (time.perf_counter() - t0) * 1000,
            validated.get("UrgencyLevel"),
            validated.get("Confidence"),
        )
    except ValueError as exc:
        await stream_queue.put(("error", {"message": str(exc)}))
        LOG.warning("[TRIAGE][STREAM][TIMING] error_ms=%.0f code=%s", (time.perf_counter() - t0) * 1000, exc)
    except Exception:
        LOG.exception("[TRIAGE][STREAM] analyze_failed elapsed_ms=%.0f", (time.perf_counter() - t0) * 1000)
        await stream_queue.put(("error", {"message": "TRIAGE_ANALYSIS_UNAVAILABLE"}))
