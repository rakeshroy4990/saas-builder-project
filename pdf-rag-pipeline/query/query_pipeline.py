from cache.query_cache import get_cached, set_cache
from config.settings import (
    MAX_CONTEXT_TOKENS,
    MIN_CHUNKS_REQUIRED,
    RAG_LOG_FULL_PROMPT,
    RAG_LOG_PROMPT_PREVIEW_CHARS,
    TEXT_SEARCH_MIN_SCORE,
)
from query.context_assembler import assemble_context, context_tokens, trim_chunks
from query.audience_classifier import infer_user_audience
from query.intent_classifier import infer_allowed_topics
from query.keyword_extractor import extract_keywords
from query.llm_service import answer_with_context
from query.retriever import retrieve_top_chunks
from query.safety_layer import check_safety
import logging
import re
from typing import List, Optional

LOG = logging.getLogger(__name__)

INSUFFICIENT_EXPERT_MESSAGE = "Insufficient data in provided context."
INSUFFICIENT_LAYMAN_MESSAGE = "I don't have enough information to answer this."


def _insufficient_message_for_audience(audience: str) -> str:
    return INSUFFICIENT_EXPERT_MESSAGE if audience == "expert" else INSUFFICIENT_LAYMAN_MESSAGE


def _answer_body_without_followups(answer: str) -> str:
    """Main reply text only (follow-up chips are not part of the cacheability decision)."""
    raw = str(answer or "")
    m = re.search(r"(?im)\n\s*Next options:\s*", raw)
    if not m:
        return raw.strip().lower()
    return raw[: m.start()].strip().lower()


def _is_non_cacheable_answer(answer: str) -> bool:
    """
    Do not cache low-value or failure replies so retrieval/model fixes can take effect on retry.
    """
    body = _answer_body_without_followups(answer)
    if not body:
        return True
    if body in {
        "i don't have enough information to answer this.",
        "insufficient data in provided context.",
        "not available",
        "not enough information in knowledge base.",
    }:
        return True
    if body.strip() == "not available":
        return True
    refusal_markers = (
        "i don't have enough information",
        "don't have enough information to answer",
        "not enough information in knowledge base",
        "not enough information to answer",
        "insufficient data in provided context",
        "is not supported by context",
        "cannot find relevant information",
        "no relevant information",
    )
    return any(marker in body for marker in refusal_markers)


def _chunk_text_for_log(text: str) -> str:
    raw = str(text or "")
    if RAG_LOG_FULL_PROMPT:
        return raw
    preview_chars = max(0, int(RAG_LOG_PROMPT_PREVIEW_CHARS))
    if preview_chars == 0 or len(raw) <= preview_chars:
        return raw
    return raw[:preview_chars] + "... [truncated]"


def _focus_chunk_text_for_query(text: str, query: str) -> str:
    raw = str(text or "")
    body = raw.split("[medical_aliases]")[0]
    # Remove heavy table delimiters / repeated separators for cleaner context.
    body = re.sub(r"\s{2,}", " ", body)
    body = re.sub(r"\s*\|\s*", " ", body)
    body = body.strip()

    keywords = [k for k in extract_keywords(query).split() if len(k) >= 2]
    if not keywords:
        return body[:1400]

    # First pass: split by sentence-ish separators and keep only relevant fragments.
    fragments = re.split(r"(?<=[\.\!\?])\s+|\n+", body)
    matched: list[str] = []
    for fragment in fragments:
        f = fragment.strip()
        if not f:
            continue
        fl = f.lower()
        if any(re.search(r"\b" + re.escape(k.lower()) + r"\b", fl) for k in keywords):
            matched.append(f)

    if not matched:
        # Fallback to keyword-centered windows when OCR/table formatting creates huge fragments.
        lowered = body.lower()
        windows: list[str] = []
        for keyword in keywords:
            for m in re.finditer(r"\b" + re.escape(keyword.lower()) + r"\b", lowered):
                start = max(0, m.start() - 260)
                end = min(len(body), m.end() + 260)
                windows.append(body[start:end].strip())
                if len(windows) >= 4:
                    break
            if len(windows) >= 4:
                break
        if windows:
            focused = " ... ".join(windows)
            focused = re.sub(r"\s{2,}", " ", focused).strip()
            return focused[:1100]
        return body[:1000]

    focused = " ".join(matched)
    focused = re.sub(r"\s{2,}", " ", focused).strip()
    # OCR often glues disease paragraph with giant table blocks. Trim hard at table-like markers.
    focused = re.split(
        r"\b(Table\s+\d+|SHORT\s+INCUBATION|MEDIUM\s+INCUBATION|LONG\s+INCUBATION|Part\s+[IVXLC]+)\b",
        focused,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip()
    # Keep first few sentences only; avoids spilling unrelated tail text.
    sentence_parts = [s.strip() for s in re.split(r"(?<=[\.\!\?])\s+", focused) if s.strip()]
    if sentence_parts:
        focused = " ".join(sentence_parts[:3]).strip()
    # Hard cap so prompt context doesn't balloon on long textbook pages.
    return focused[:1100]


def _history_pairs(history: Optional[list]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for item in history or []:
        if isinstance(item, dict):
            role = str(item.get("Role") or item.get("role") or "").strip().lower()
            content = str(item.get("Content") or item.get("content") or "").strip()
        else:
            role = str(getattr(item, "role", "")).strip().lower()
            content = str(getattr(item, "content", "")).strip()
        if content:
            pairs.append((role or "user", content))
    return pairs


def _build_effective_question(user_query: str, history: Optional[list]) -> str:
    latest = str(user_query or "").strip()
    if not history:
        return latest
    turns = _history_pairs(history)[-6:]
    if not turns:
        return latest
    # Retrieval should be anchored on user intent, not assistant phrasing.
    # Including assistant responses often dilutes keywords and hurts relevance.
    user_turns = [content for role, content in turns if role in {"user", "patient"}]
    if not user_turns:
        return latest
    transcript = " ".join(user_turns[-3:])
    return f"{transcript} {latest}".strip()


def _build_cache_query_key(user_query: str) -> str:
    """
    Keep cache key stable across turns for the same visible question.
    Do NOT include assistant/user transcript in cache identity.
    """
    return str(user_query or "").strip()


async def handle_query(
        user_query: str,
        user_id: str = "",
        user_roles: Optional[List[str]] = None,
        conversation_id: str = "default",
        history: Optional[list] = None,
) -> dict:
    LOG.info("[RAG][QUERY] user_id=%s conversation_id=%s question=%s", user_id or "", conversation_id or "default", user_query)
    audience = infer_user_audience(user_roles or [])
    effective_question = _build_effective_question(user_query, history)
    cache_query_key = _build_cache_query_key(user_query)
    cached = get_cached(cache_query_key, audience=audience)
    if cached:
        LOG.info("[RAG][CACHE] hit question=%s audience=%s", user_query, audience)
        return {
            "answer": str(cached.get("answer", "")).strip(),
            "follow_up_questions": cached.get("follow_up_questions", []),
            "source": "cache"
        }
    LOG.info("[RAG][CACHE] miss question=%s audience=%s", user_query, audience)

    safety = check_safety(user_query)
    if not safety.safe:
        return {"answer": safety.reason, "follow_up_questions": [], "source": "safety_block"}

    if safety.escalate:
        return {
            "answer": "Your symptoms may indicate an emergency. Please call emergency services or visit the nearest hospital immediately.",
            "follow_up_questions": [],
            "source": "escalation",
        }

    max_chunks = 2 if len(user_query) < 20 else 3
    allowed_topics = infer_allowed_topics(effective_question)
    LOG.info("[RAG][INTENT] question=%s allowed_topics=%s audience=%s", user_query, allowed_topics, audience)
    chunks = retrieve_top_chunks(
        effective_question,
        top_k=max_chunks,
        min_score=TEXT_SEARCH_MIN_SCORE,
        chapter_topics=allowed_topics,
        audience=audience,
    )
    LOG.info(
        "[RAG][RETRIEVE] question=%s max_chunks=%s min_score=%s retrieved=%s",
        user_query,
        max_chunks,
        TEXT_SEARCH_MIN_SCORE,
        len(chunks),
    )
    if chunks:
        chunk_refs = [f"{c.get('source_file', 'unknown')}#p{c.get('page_num', '?')}" for c in chunks]
        LOG.info("[RAG][RETRIEVE] chunk_refs=%s", chunk_refs)
    if not chunks:
        LOG.warning("[RAG][INSUFFICIENT] no chunks after retrieval query=%s", user_query)
        return {
            "answer": _insufficient_message_for_audience(audience),
            "follow_up_questions": [],
            "source": "insufficient_chunks",
        }
    if len(chunks) < MIN_CHUNKS_REQUIRED:
        LOG.warning(
            "[RAG][INSUFFICIENT] chunks_below_min query=%s chunks=%s min_required=%s",
            user_query,
            len(chunks),
            MIN_CHUNKS_REQUIRED,
        )
        return {
            "answer": _insufficient_message_for_audience(audience),
            "follow_up_questions": [],
            "source": "insufficient_chunks",
        }

    selected = assemble_context(chunks, max_chunks=max_chunks)
    context_token_count = context_tokens(selected)
    LOG.info(
        "[RAG][CONTEXT] selected=%s context_tokens=%s max_context_tokens=%s",
        len(selected),
        context_token_count,
        MAX_CONTEXT_TOKENS,
    )
    if context_token_count > MAX_CONTEXT_TOKENS:
        selected = trim_chunks(selected)
        context_token_count = context_tokens(selected)
        LOG.info(
            "[RAG][CONTEXT] trimmed_selected=%s context_tokens=%s",
            len(selected),
            context_token_count,
        )

    if len(selected) < MIN_CHUNKS_REQUIRED:
        return {
            "answer": _insufficient_message_for_audience(audience),
            "follow_up_questions": [],
            "source": "insufficient_chunks",
        }
    for idx, chunk in enumerate(selected, start=1):
        LOG.info(
            "[RAG][SELECTED_CHUNK] index=%s source=%s page=%s weighted_score=%s text=\n%s",
            idx,
            chunk.get("source_file", "unknown"),
            chunk.get("page_num", "?"),
            chunk.get("weighted_score", chunk.get("score", "")),
            _chunk_text_for_log(chunk.get("text", "")),
        )

    focused_selected = []
    for chunk in selected:
        focused_text = _focus_chunk_text_for_query(chunk.get("text", ""), effective_question)
        focused_selected.append({**chunk, "text": focused_text})
        LOG.info(
            "[RAG][FOCUSED_CHUNK] source=%s page=%s focused_chars=%s",
            chunk.get("source_file", "unknown"),
            chunk.get("page_num", "?"),
            len(focused_text),
        )
    llm_result = answer_with_context(user_query, focused_selected, audience=audience)
    answer = str(llm_result.get("answer", "")).strip()
    follow_up_questions = llm_result.get("follow_up_questions")
    if not isinstance(follow_up_questions, list):
        follow_up_questions = []
    if not _is_non_cacheable_answer(answer):
        set_cache(
            cache_query_key,
            answer,
            audience=audience,
            follow_up_questions=follow_up_questions,
        )
        LOG.info("[RAG][CACHE] stored question=%s audience=%s", user_query, audience)
    else:
        LOG.info("[RAG][CACHE] skipped_store_for_fallback question=%s", user_query)

    return {
        "answer": answer,
        "follow_up_questions": follow_up_questions,
        "source": "rag",
        "chunks_used": len(selected),
        "context_tokens": context_token_count,
        "max_chunks": max_chunks,
        "user_id": user_id,
    }
