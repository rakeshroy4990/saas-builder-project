import google.generativeai as genai
from openai import OpenAI
import logging
import re

from query.keyword_extractor import SHORT_MEDICAL_TERMS, extract_keywords

from config.settings import (
    GEMINI_API_KEY,
    LLM_MODEL,
    LLM_PROVIDER,
    OPENAI_API_KEY,
    RAG_LOG_FULL_PROMPT,
    RAG_LOG_PROMPT_PREVIEW_CHARS,
)

LOG = logging.getLogger(__name__)


def _is_first_person_health_query(query: str) -> bool:
    q = str(query or "").lower()
    return bool(re.search(r"\b(i have|i am|my)\b", q))


def _strip_next_options_block(text: str) -> str:
    """Remove a trailing 'Next options:' section so we can replace it with grounded bullets."""
    raw = str(text or "")
    m = re.search(r"(?im)\n\s*Next options:\s*", raw)
    if not m:
        return raw.rstrip()
    return raw[: m.start()].rstrip()


def _answer_body_for_refusal(answer: str) -> str:
    return _strip_next_options_block(answer).strip().lower()


def _looks_like_refusal(answer: str) -> bool:
    a = _answer_body_for_refusal(answer)
    if not a:
        return False
    if a in {
        "i don't have enough information to answer this.",
        "not available",
        "not enough information in knowledge base.",
    }:
        return True
    if a.strip() == "not available":
        return True
    snippets = (
        "i don't have enough information",
        "don't have enough information to answer",
        "not enough information in knowledge base",
        "not enough information to answer",
        "is not supported by context",
        "cannot find relevant information",
        "no relevant information",
    )
    return any(s in a for s in snippets)


def _build_contextual_fallback(query: str, chunks: list[dict]) -> str:
    context = " ".join(str(c.get("text", "")) for c in (chunks or []))
    context = re.sub(r"\s{2,}", " ", context).strip()
    testing_hint = ""
    for sentence in re.split(r"(?<=[\.\!\?])\s+", context):
        s = sentence.strip()
        if not s:
            continue
        if re.search(r"\b(test|assay|screen|x-?ray|culture|pcr)\b", s, flags=re.IGNORECASE):
            testing_hint = s
            break

    disease_hint = ""
    q_tokens = [t for t in re.findall(r"[a-zA-Z]{3,}", query.lower()) if t not in {"have", "with", "and", "the"}]
    for sentence in re.split(r"(?<=[\.\!\?])\s+", context):
        s = sentence.strip()
        if any(re.search(r"\b" + re.escape(t) + r"\b", s, flags=re.IGNORECASE) for t in q_tokens):
            disease_hint = s
            break
    if not disease_hint:
        disease_hint = "The context mentions this condition and indicates it is clinically important."

    guidance = [
        "1) What the context says:",
        f"- {disease_hint}",
        "2) Evaluation/testing from context:",
        f"- {testing_hint or 'Context indicates formal medical testing/screening may be required.'}",
        "3) Next step:",
        "- Please see a doctor promptly for in-person evaluation and confirmatory testing. Seek urgent care if symptoms worsen.",
    ]
    return "\n".join(guidance)


def _prompt_preview(prompt: str, preview_chars: int) -> str:
    if preview_chars <= 0:
        return ""
    if len(prompt) <= preview_chars:
        return prompt
    return prompt[:preview_chars] + "\n... [truncated]"


def _build_prompt(query: str, chunks: list[dict], audience: str = "layman") -> str:
    context = "\n\n".join(
        [f"[Source: {c['source_file']}, Page {c['page_num']}]\n{c['text']}" for c in chunks]
    )
    audience_rules = (
        "Audience: layman/patient. Use simple everyday language, avoid jargon, "
        "and explain terms in plain words."
        if audience == "layman"
        else "Audience: expert/doctor. You may use concise clinical terminology and structured medical language."
    )
    return f"""You are a helpful medical information assistant.
Use ONLY the context below to answer the question.
Never diagnose. Always recommend seeing a doctor for personal medical decisions.
{audience_rules}

If the user asks in first person (e.g., "I have <condition>") and the condition is explicitly present in context:
- Do NOT reply with only "I don't have enough information to answer this."
- Give concise, practical guidance grounded in context:
  1) what the context says about the condition,
  2) what evaluation/testing is mentioned in context (if any),
  3) clear next medical follow-up recommendation.

Only use "I don't have enough information to answer this." when the condition/topic itself is not supported by context.

If you include follow-ups, they MUST reference the user's topic or exact wording from CONTEXT (do not suggest unrelated diseases or chapters).

CONTEXT:
{context}

QUESTION: {query}

ANSWER:"""


def _query_keywords_for_match(query: str) -> list[str]:
    raw = extract_keywords(query)
    return [t.lower() for t in raw.split() if t and (len(t) >= 3 or t in SHORT_MEDICAL_TERMS)][:14]


def _context_blob(chunks: list[dict]) -> str:
    return " ".join(str(c.get("text") or "") for c in (chunks or [])).lower()


def _context_covers_query_terms(query: str, chunks: list[dict]) -> bool:
    """True when retrieved text plausibly mentions the user's topic (not only generic words like 'signs')."""
    blob = _context_blob(chunks)
    generic = {
        "signs",
        "symptoms",
        "symptom",
        "treatment",
        "treatments",
        "causes",
        "cause",
        "diagnosis",
        "effects",
        "effect",
        "risk",
        "risks",
        "prevention",
        "test",
        "tests",
    }
    focus = _best_focus_term(query).lower()
    if focus and focus not in generic:
        if focus in SHORT_MEDICAL_TERMS and re.search(r"\b" + re.escape(focus) + r"\b", blob):
            return True
        if len(focus) >= 4 and re.search(r"\b" + re.escape(focus) + r"\b", blob):
            return True
    for kw in _query_keywords_for_match(query):
        if kw in generic:
            continue
        if len(kw) < 4 and kw not in SHORT_MEDICAL_TERMS:
            continue
        if re.search(r"\b" + re.escape(kw) + r"\b", blob):
            return True
    return False


def _best_focus_term(query: str) -> str:
    tokens = [t for t in extract_keywords(query).split() if t]
    if not tokens:
        return ""
    substantive = [t for t in tokens if len(t) >= 4 or t in SHORT_MEDICAL_TERMS]
    pool = substantive if substantive else tokens
    return max(pool, key=len)


def _chunk_topic_hints(chunks: list[dict]) -> list[str]:
    hints: list[str] = []
    seen: set[str] = set()
    for c in chunks or []:
        meta = c.get("metadata")
        if isinstance(meta, dict):
            t = str(meta.get("chapter_topic") or "").strip()
            if t and t.lower() not in seen:
                seen.add(t.lower())
                hints.append(t[:72])
        if len(hints) >= 4:
            break
    if len(hints) < 2:
        for c in chunks or []:
            sf = str(c.get("source_file") or "").strip()
            if not sf:
                continue
            base = sf.rsplit("/", 1)[-1].replace("_", " ")
            if base.lower().endswith(".pdf"):
                base = base[:-4]
            base = base.strip()[:64]
            if base and base.lower() not in seen:
                seen.add(base.lower())
                hints.append(base)
            if len(hints) >= 3:
                break
    return hints[:3]


def _build_grounded_next_option_lines(query: str, chunks: list[dict], audience: str) -> list[str]:
    """
    Suggested follow-ups must be tied to retrieved excerpts (or honestly say the match is weak).
    Never invent unrelated clinical topics.
    """
    focus = _best_focus_term(query)
    hints = _chunk_topic_hints(chunks)
    covered = _context_covers_query_terms(query, chunks)
    if covered and focus:
        if audience == "expert":
            return [
                f"Summarize management, complications, or staging for **{focus}** using only the cited excerpts.",
                f"What diagnostics, labs, or public-health measures for **{focus}** appear on these pages?",
                "List red-flag or follow-up criteria that appear in CONTEXT only (no outside sources).",
            ]
        return [
            f"What signs, course, or complications of **{focus}** do the cited pages describe?",
            f"What care, isolation, or follow-up for **{focus}** is mentioned in the text?",
            "Give a short bullet list limited strictly to these page excerpts.",
        ]
    h0 = hints[0] if hints else "the topics on the retrieved pages"
    lines = [
        (
            f"The excerpts may not clearly contain **{focus}**—try rephrasing with a term from **{h0}**."
            if focus
            else f"The retrieved pages center on **{h0}**—try a question using that wording."
        ),
    ]
    if len(hints) > 1:
        lines.append(f"Ask what the materials say about **{hints[1]}** (stay within these sources).")
    else:
        lines.append("Try one phrase from the PDF title or a subheading that appears in the excerpts.")
    if audience == "expert":
        lines.append("Request differentials or workup only for entities explicitly named in CONTEXT.")
    else:
        lines.append("Ask what your book says about when to seek care—using only these cited pages.")
    return lines[:3]


def _finalize_answer(raw: str, query: str, chunks: list[dict], audience: str) -> str:
    body = _strip_next_options_block(raw).strip()
    opts = _build_grounded_next_option_lines(query, chunks, audience)
    return body + "\n\nNext options:\n- " + "\n- ".join(opts)


def answer_with_context(query: str, chunks: list[dict], audience: str = "layman") -> str:
    prompt = _build_prompt(query, chunks, audience=audience)
    LOG.info(
        "[RAG][LLM] provider=%s model=%s audience=%s query_len=%s chunks=%s prompt_chars=%s",
        LLM_PROVIDER,
        LLM_MODEL,
        audience,
        len(query or ""),
        len(chunks or []),
        len(prompt),
    )
    if RAG_LOG_FULL_PROMPT:
        LOG.info("[RAG][LLM_PROMPT_START]\n%s\n[RAG][LLM_PROMPT_END]", prompt)
    else:
        preview = _prompt_preview(prompt, RAG_LOG_PROMPT_PREVIEW_CHARS)
        LOG.info(
            "[RAG][LLM_PROMPT_PREVIEW full=false chars=%s]\n%s",
            RAG_LOG_PROMPT_PREVIEW_CHARS,
            preview,
        )

    try:
        if LLM_PROVIDER == "gemini":
            if not GEMINI_API_KEY:
                LOG.warning("[RAG][LLM] GEMINI_API_KEY missing; returning fallback")
                return _finalize_answer("Not available", query, chunks, audience)
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(LLM_MODEL)
            response = model.generate_content(prompt)
            answer = (response.text or "").strip() or "Not available"
            if _looks_like_refusal(answer) and (
                _is_first_person_health_query(query) or _context_covers_query_terms(query, chunks)
            ):
                answer = _build_contextual_fallback(query, chunks)
            return _finalize_answer(answer, query, chunks, audience)

        if not OPENAI_API_KEY:
            LOG.warning("[RAG][LLM] OPENAI_API_KEY missing; returning fallback")
            return _finalize_answer("Not available", query, chunks, audience)
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.responses.create(model=LLM_MODEL, input=prompt)
        answer = (response.output_text or "").strip() or "Not available"
        if _looks_like_refusal(answer) and (
            _is_first_person_health_query(query) or _context_covers_query_terms(query, chunks)
        ):
            answer = _build_contextual_fallback(query, chunks)
        return _finalize_answer(answer, query, chunks, audience)
    except Exception:
        # Avoid failing the entire API request when provider call is unavailable/misconfigured.
        LOG.exception("[RAG][LLM] provider call failed; returning fallback")
        return _finalize_answer("Not available", query, chunks, audience)
