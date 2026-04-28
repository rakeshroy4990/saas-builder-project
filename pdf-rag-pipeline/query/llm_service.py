import google.generativeai as genai
from openai import OpenAI
import json
import logging
import re
from typing import Optional

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

MAX_CONTEXT_CHARS = 8_000

INSUFFICIENT_EXPERT_MESSAGE = "Insufficient data in provided context."
INSUFFICIENT_LAYMAN_MESSAGE = "I don't have enough information to answer this."
 
STOPWORDS = {
    "have", "with", "and", "the", "for", "this", "that", "are",
    "from", "your", "what", "which", "will", "been", "they",
    "their", "there", "was", "were", "has", "had", "but", "not",
    "can", "its", "into", "also", "more", "than", "then", "when",
}

ABBREV_PATTERN = re.compile(
    r"\b(Dr|Mr|Mrs|Ms|Prof|Fig|vs|e\.g|i\.e|approx|etc)\."
)

TESTING_PATTERN = re.compile(
    r"\b(test|assay|screen|x-?ray|culture|pcr|biopsy|scan|mri|ct|ultrasound|bloodwork)\b",
    flags=re.IGNORECASE,
)

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
        "insufficient data in provided context.",
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
        "insufficient data in provided context",
        "is not supported by context",
        "cannot find relevant information",
        "no relevant information",
    )
    return any(s in a for s in snippets)

URGENCY_PATTERN = re.compile(
    r"\b(emergency|urgent|severe|critical|chest pain|can't breathe|bleeding|stroke|seizure)\b",
    flags=re.IGNORECASE,
)

EVAL_LEAD_INS = re.compile(
    r"^\s*(evaluation|testing|assessment|screening|diagnosis)\b",
    flags=re.IGNORECASE,
)

def _to_conversational_answer(
    disease_sentence: Optional[str],
    testing_sentence: Optional[str],
    query: str,
) -> str:
    parts: list[str] = []

    # Gap 6: guard against whitespace-only strings
    disease_sentence = disease_sentence.strip() if disease_sentence else None
    testing_sentence = testing_sentence.strip() if testing_sentence else None

    # Opening
    if disease_sentence:
        opener = disease_sentence.removesuffix(".")  # Gap 1: exact single suffix removal
        parts.append(f"{opener}.")
    else:
        # Gap 2: extract noun phrase, not raw query
        topic = re.sub(r"^(what|how|why|when|is|are|can|does|do)\s+", "", query.strip().rstrip("?"), flags=re.IGNORECASE)
        parts.append(
            f"There isn't enough specific information available to fully answer about {topic}, "
            f"but here's what can be said generally."
        )

    # Middle
    if testing_sentence:
        # Gap 4: strip whitespace before removesuffix
        testing_clean = testing_sentence.strip().removesuffix(".")
        # Gap 3: suppress bridge if sentence already has an eval lead-in
        if EVAL_LEAD_INS.match(testing_clean):
            parts.append(f"{testing_clean}.")
        else:
            parts.append(f"For evaluation, {testing_clean}.")
    else:
        parts.append(
            "A proper evaluation would typically involve a clinical assessment "
            "and possibly some diagnostic tests, depending on the presentation."
        )

    # Closing — Gap 7: only add urgency cue if query signals it
    base_close = (
        "It's best to see a doctor in person for a thorough evaluation "
        "and any confirmatory testing."
    )
    if URGENCY_PATTERN.search(query):
        base_close += " If symptoms are worsening or severe, please seek urgent care."
    parts.append(base_close)

    # Gap 5: normalise each part before joining
    return " ".join(p.strip() for p in parts)
    
def _safe_split_sentences(text: str) -> list[str]:
    masked = ABBREV_PATTERN.sub(lambda m: m.group(0).replace(".", "·"), text)
    parts = re.split(r"(?<=[\.\!\?])\s+", masked)
    return [p.replace("·", ".").strip() for p in parts if p.strip()]
 
 
def _score_sentence(sentence: str, tokens: list[str]) -> int:
    s_lower = sentence.lower()
    return sum(
        1 for t in tokens
        if re.search(r"\b" + re.escape(t) + r"\b", s_lower)
    )
 
 
def _extract_chunks_text(chunks: list) -> str:
    parts = []
    total = 0
    for c in (chunks or []):
        if not isinstance(c, dict):
            continue
        text = str(c.get("text", "")).strip()
        if not text:
            continue
        remaining = MAX_CONTEXT_CHARS - total
        if remaining <= 0:
            break
        parts.append(text[:remaining])
        total += len(text)
    raw = " ".join(parts)
    return re.sub(r"\s{2,}", " ", raw).strip()

def _build_contextual_fallback(query: str, chunks: list[dict]) -> str:
    """
    Returns a plain conversational string answer.
    No labels, no 'context' mentions — reads like a direct Q&A response.
    """
    context = _extract_chunks_text(chunks)
    sentences = _safe_split_sentences(context)
 
    q_tokens = [
        t for t in re.findall(r"[a-zA-Z]{3,}", query.lower())
        if t not in STOPWORDS
    ]
 
    # Best disease/condition sentence by query token overlap
    best_disease: Optional[str] = None
    best_disease_score = 0
    for s in sentences:
        score = _score_sentence(s, q_tokens)
        if score > best_disease_score:
            best_disease_score = score
            best_disease = s
 
    # Best testing sentence (also prefers query relevance)
    best_testing: Optional[str] = None
    best_testing_score = 0
    for s in sentences:
        if TESTING_PATTERN.search(s):
            score = _score_sentence(s, q_tokens)
            if score >= best_testing_score:
                best_testing_score = score
                best_testing = s
 
    return _to_conversational_answer(best_disease, best_testing, query)
 



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
    if audience == "expert":
        return f"""You are a medical information assistant for healthcare professionals.

Guidelines:
- Provide clinically accurate, structured, and detailed information
- Use medical terminology (no simplification unless necessary)
- Focus on pathophysiology, diagnosis, and management
- Do NOT include emotional language, reassurance, or personal advice
- Do NOT address the user directly as a patient
- Keep tone objective and educational
- Use ONLY the provided context; do not add external facts

At the end of the response, suggest 2–4 clinically relevant follow-up questions.

Guidelines:
- Focus on differential diagnosis, investigations, or management
- Keep them precise and medically relevant
- Avoid basic or obvious questions

If information is insufficient, say exactly: "{INSUFFICIENT_EXPERT_MESSAGE}"

Return strict JSON only (no markdown, no prose outside JSON) with this shape:
{{
  "answer": "<main response text>",
  "follow_up_questions": ["<question 1>", "<question 2>"]
}}

CONTEXT:
{context}

QUESTION: {query}

ANSWER:"""
    return f"""You are a medical information assistant for patients.

Guidelines:
- Use simple, clear, non-technical language
- Be empathetic and supportive in tone
- Explain the condition, symptoms, and general next steps
- Avoid overwhelming details
- Encourage consulting a doctor for diagnosis/treatment
- Do NOT provide definitive diagnosis
- Use ONLY the provided context; do not add external facts

At the end of the response, suggest 2–3 helpful follow-up questions the patient might ask next.

Guidelines:
- Keep them simple and relevant
- Focus on symptoms, next steps, or safety
- Be supportive and practical

If information is insufficient, say exactly: "{INSUFFICIENT_LAYMAN_MESSAGE}"

Return strict JSON only (no markdown, no prose outside JSON) with this shape:
{{
  "answer": "<main response text>",
  "follow_up_questions": ["<question 1>", "<question 2>"]
}}

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
                f"Would you like a concise clinical summary for **{focus}** (management, complications, and staging)?",
                f"Should I outline relevant diagnostics, labs, and public-health considerations for **{focus}**?",
                "Do you want red-flag signs and follow-up criteria to monitor next?",
            ]
        return [
            f"Would you like me to explain common signs, expected course, and possible complications of **{focus}**?",
            f"Do you want practical care steps and follow-up advice for **{focus}**?",
            "I can also give a short checklist of warning signs for when to seek urgent care.",
        ]
    h0 = hints[0] if hints else "the main symptom area"
    lines = [
        (
            f"I do not have enough details yet about **{focus}** to guide you clearly. Try asking with a symptom or condition term like **{h0}**."
            if focus
            else f"To help you better, try rephrasing your question with a symptom or condition term like **{h0}**."
        ),
    ]
    if len(hints) > 1:
        lines.append(f"You can also ask specifically about **{hints[1]}**.")
    else:
        lines.append("You can include symptom duration, severity, and related symptoms for a more useful reply.")
    if audience == "expert":
        lines.append("If helpful, ask for a focused differential and workup plan.")
    else:
        lines.append("If symptoms are severe or worsening, please seek in-person medical care promptly.")
    return lines[:3]


def _default_follow_ups_for_audience(audience: str) -> list[str]:
    if audience == "expert":
        return [
            "What differential diagnoses are most likely based on this presentation?",
            "Which investigations are highest yield to confirm the diagnosis?",
            "What initial management steps should be prioritized now?",
        ]
    return [
        "What symptoms should I watch closely over the next 24 hours?",
        "What should I do next at home before seeing a doctor?",
        "When should I seek urgent medical care?",
    ]


def _parse_follow_up_questions(raw: object, audience: str) -> list[str]:
    if not isinstance(raw, list):
        return _default_follow_ups_for_audience(audience)
    cleaned: list[str] = []
    seen: set[str] = set()
    max_items = 4 if audience == "expert" else 3
    for value in raw:
        item = str(value or "").strip()
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(item)
        if len(cleaned) >= max_items:
            break
    return cleaned if cleaned else _default_follow_ups_for_audience(audience)


def _extract_json_object(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return "{}"
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return "{}"
    return text[start : end + 1]


def _coerce_structured_output(raw: str, audience: str) -> dict:
    parsed_obj: dict = {}
    try:
        parsed_obj = json.loads(_extract_json_object(raw))
        if not isinstance(parsed_obj, dict):
            parsed_obj = {}
    except Exception:
        parsed_obj = {}
    body = _strip_next_options_block(str(parsed_obj.get("answer") if parsed_obj else raw)).strip()
    if not body:
        body = INSUFFICIENT_EXPERT_MESSAGE if audience == "expert" else INSUFFICIENT_LAYMAN_MESSAGE
    if audience != "expert" and "i am not a doctor" not in body.lower():
        body = f"{body}\n\nI am not a doctor."
    follow_ups = _parse_follow_up_questions(parsed_obj.get("follow_up_questions"), audience)
    return {"answer": body, "follow_up_questions": follow_ups}


def _finalize_answer(raw: str, query: str, chunks: list[dict], audience: str) -> dict:
    return _coerce_structured_output(raw, audience)


def answer_with_context(query: str, chunks: list[dict], audience: str = "layman") -> dict:
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
