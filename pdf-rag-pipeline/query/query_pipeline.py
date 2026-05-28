from cache.query_cache import get_cached, set_cache
from contextlib import nullcontext
from config.settings import (
    IMAGE_CONTEXT_PAGE_WINDOW,
    MAX_CHUNKS,
    MAX_CONTEXT_TOKENS,
    MIN_CHUNKS_REQUIRED,
    RAG_CHAT_INCLUDE_SOURCE_FIGURES,
    RAG_LOG_FULL_PROMPT,
    RAG_LOG_PROMPT_PREVIEW_CHARS,
    RAG_ENABLE_HYDE,
    RAG_USE_VECTOR_RETRIEVAL,
    TEXT_SEARCH_MIN_SCORE,
    VECTOR_CONTEXT_MAX_TEXT_CHUNKS,
    VECTOR_TOP_K_IMAGE,
    is_postgres_persistence,
    LLM_PROVIDER,
)
from query.context_assembler import assemble_context, context_tokens, trim_chunks
from query.audience_classifier import infer_user_audience
from query.intent_classifier import infer_allowed_topics
from query.keyword_extractor import extract_keywords
from query.llm_service import (
    answer_with_context,
    async_iter_openai_chat_stream_tokens,
    finalize_streamed_llm_raw,
    iter_openai_chat_stream_tokens,
    _build_stream_plain_prompt,
)
from query import llm_service
from query.rag_timing import bind_query_wall_clock, log_timing
from query.retriever import retrieve as retrieve_hyde_chunks, retrieve_top_chunks
from query.safety_layer import check_safety
from db.image_store import build_public_image_url
from perf.perf_context import PERF_ENABLED, PerfTrace, finalize_perf, timed_span
import asyncio
import hashlib
import logging
import re
import time
from typing import List, Optional

LOG = logging.getLogger(__name__)


async def _emit_stream_payload(stream_queue: asyncio.Queue, payload: dict) -> None:
    """Emit ready + chunked answer + complete for short-circuit / non-token-stream paths."""
    await stream_queue.put(
        (
            "ready",
            {
                "source": str(payload.get("source") or ""),
                "images": payload.get("images") or [],
                "chunksUsed": int(payload.get("chunks_used") or 0) or None,
            },
        )
    )
    ans = str(payload.get("answer") or "")
    step = 120
    for i in range(0, len(ans), step):
        await stream_queue.put(("delta", ans[i : i + step]))
    if not ans:
        await stream_queue.put(("delta", ""))
    await stream_queue.put(("complete", payload))


async def _return_with_stream(stream_queue: Optional[asyncio.Queue], payload: dict) -> dict:
    if stream_queue is not None:
        await _emit_stream_payload(stream_queue, payload)
    return payload

_DEFINITION_QUERY_RE = re.compile(
    r"^\s*(what\s+is|what\s+are|define|definition\s+of|tell\s+me\s+about|describe)\b",
    re.IGNORECASE,
)

INSUFFICIENT_EXPERT_MESSAGE = "Insufficient data in provided context."
INSUFFICIENT_LAYMAN_MESSAGE = "I don't have enough information to answer this."

# Regex to parse inline image markers in chunk text:
#   [IMAGE:0 | page=7 | ext=png | Figure related to: X.]
# Legacy supported:
#   [IMAGE:0 | page=7 | Figure related to: X.]
_IMAGE_MARKER_RE = re.compile(
    r'\[IMAGE:(\d+)\s*\|\s*page=(\d+)\s*(?:\|\s*ext=([a-zA-Z0-9]+)\s*)?\|\s*([^\]]+)\]'
)
_IMAGE_DATA_RE = re.compile(r'\[IMAGE_DATA:(\d+):([A-Za-z0-9+/=]+)\]')


# ── Image helpers ─────────────────────────────────────────────────────────────

def _extract_images_from_chunk(text: str) -> list[dict]:
    """
    Pull every inline image out of a chunk string.
    Returns list of { img_index, page, caption, image_data (b64 str) }
    so the caller never has to touch raw bytes.
    """
    images = []
    data_by_index: dict[int, str] = {}
    for data_match in _IMAGE_DATA_RE.finditer(text or ""):
        try:
            data_by_index[int(data_match.group(1))] = data_match.group(2)
        except (TypeError, ValueError):
            continue

    for m in _IMAGE_MARKER_RE.finditer(text or ""):
        img_index = int(m.group(1))
        images.append({
            "img_index":  img_index,
            "page":       int(m.group(2)),
            "ext":        (m.group(3) or "png").strip().lower(),
            "caption":    m.group(4).strip(),
            "image_data": data_by_index.get(img_index, ""),
        })
    return images


def _strip_image_markers(text: str) -> str:
    """
    Remove IMAGE_DATA lines from text before sending to the LLM.
    The LLM sees the caption (searchable) but not the raw base64 blob
    — keeps the prompt small and avoids token waste.
    """
    # Remove [IMAGE_DATA:N:....] lines entirely
    text = re.sub(r'\[IMAGE_DATA:\d+:[A-Za-z0-9+/=]+\]\n?', '', text)
    # Normalise leftover blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _build_image_context_for_llm(images: list[dict]) -> str:
    """
    Append a compact image summary at the end of the chunk text
    so the LLM knows images exist and can reference them by index.
    """
    if not images:
        return ""
    lines = ["\n[Attached figures in this excerpt:]"]
    for img in images:
        lines.append(f"  • Figure {img['img_index']} (page {img['page']}): {img['caption']}")
    return "\n".join(lines)


# ── Existing helpers (unchanged) ──────────────────────────────────────────────

def _insufficient_message_for_audience(audience: str) -> str:
    return INSUFFICIENT_EXPERT_MESSAGE if audience == "expert" else INSUFFICIENT_LAYMAN_MESSAGE


def _images_from_vector_api(api_images: list[dict]) -> list[dict]:
    """Shape vector-retrieved figure metadata for the query API response."""
    out: list[dict] = []
    for i, img in enumerate(api_images):
        raw_url = str(img.get("url") or "").strip()
        preview_url = str(img.get("page_preview_url") or "").strip()
        crop_suspect = bool(img.get("crop_suspect"))
        url = preview_url if crop_suspect and preview_url else raw_url
        if not url:
            continue
        ph = int(img.get("page_hint") or 0)
        caption = str(img.get("caption") or "").strip()
        if crop_suspect and preview_url:
            reason = str(img.get("crop_suspect_reason") or "").strip()
            note = "Showing full page preview because the extracted figure may be clipped"
            if reason:
                note = f"{note} ({reason})"
            caption = f"{note}. {caption}".strip()
        out.append({
            "img_index": i,
            "page": ph,
            "ext": "png",
            "caption": caption,
            "image_data": "",
            "url": url,
            "source_file": str(img.get("source_file") or ""),
        })
    return out


def _collect_all_response_images(
    selected: list[dict],
    used_vector: bool,
    api_images: list[dict],
) -> list[dict]:
    """Build API figure list (may query DB for page-local images)."""
    from query.vector_retriever import (
        collect_page_local_images_for_selected_chunks,
        filter_api_images_by_selected_chunks,
    )

    filtered_vector_images: list[dict] = []
    all_response_images: list[dict] = []
    seen_image_keys: set[str] = set()

    if not RAG_CHAT_INCLUDE_SOURCE_FIGURES:
        LOG.info("[RAG][FIGURES] source figures omitted (RAG_CHAT_INCLUDE_SOURCE_FIGURES=false)")
        return []

    if used_vector:
        filtered_vector_images = collect_page_local_images_for_selected_chunks(
            selected,
            page_window=IMAGE_CONTEXT_PAGE_WINDOW,
            max_return=VECTOR_TOP_K_IMAGE,
        )
        if not filtered_vector_images and api_images:
            filtered_vector_images = filter_api_images_by_selected_chunks(
                api_images,
                selected,
                page_window=IMAGE_CONTEXT_PAGE_WINDOW,
                max_return=VECTOR_TOP_K_IMAGE,
            )

    if used_vector and filtered_vector_images:
        return _images_from_vector_api(filtered_vector_images)

    for chunk in selected:
        for img in _extract_images_for_response(chunk):
            key = f"{chunk.get('page_num')}_{img['img_index']}"
            if key not in seen_image_keys:
                seen_image_keys.add(key)
                all_response_images.append(img)
    return all_response_images


def _build_focused_selected(
    selected: list[dict],
    effective_question: str,
    used_vector: bool,
    fig_summary_chunk: Optional[dict] = None,
) -> list[dict]:
    selected_for_llm = list(selected)
    if fig_summary_chunk:
        selected_for_llm.append(fig_summary_chunk)
        if context_tokens(selected_for_llm) > MAX_CONTEXT_TOKENS:
            selected_for_llm.pop()
    focused_selected: list[dict] = []
    for chunk in selected_for_llm:
        focused_text = _chunk_text_for_llm(
            chunk.get("text", ""),
            effective_question,
            from_vector=used_vector,
        )
        focused_selected.append({**chunk, "text": focused_text})
        LOG.info(
            "[RAG][FOCUSED_CHUNK] source=%s page=%s focused_chars=%s images_in_chunk=%s",
            chunk.get("source_file", "unknown"),
            chunk.get("page_num", "?"),
            len(focused_text),
            len(_extract_images_for_response(chunk)),
        )
    return focused_selected


def _answer_body_without_followups(answer: str) -> str:
    raw = str(answer or "")
    m = re.search(r"(?im)\n\s*Next options:\s*", raw)
    if not m:
        return raw.strip().lower()
    return raw[: m.start()].strip().lower()


def _is_non_cacheable_answer(answer: str) -> bool:
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
    raw = _strip_image_markers(str(text or ""))   # don't flood logs with base64
    if RAG_LOG_FULL_PROMPT:
        return raw
    preview_chars = max(0, int(RAG_LOG_PROMPT_PREVIEW_CHARS))
    if preview_chars == 0 or len(raw) <= preview_chars:
        return raw
    return raw[:preview_chars] + "... [truncated]"


def _is_broad_definition_query(q: str) -> bool:
    return bool(_DEFINITION_QUERY_RE.search(str(q or "").strip()))


def _chunk_text_for_llm(text: str, query: str, *, from_vector: bool) -> str:
    """
    FTS chunks use tight keyword focus to drop noise. Vector/Marker chunks already rank well;
    aggressive focus destroys tables and diagnostic criteria (e.g. major/minor features).
    """
    raw = str(text or "")
    if from_vector:
        body = _strip_image_markers(raw).split("[medical_aliases]")[0]
        body = re.sub(r"\s{2,}", " ", body).strip()
        max_chars = 14_000
        if len(body) > max_chars:
            body = body[: max_chars - 24].rstrip() + "\n… [truncated]"
        summary = _build_image_context_for_llm(_extract_images_from_chunk(raw))
        return f"{body}{summary}".strip()
    return _focus_chunk_text_for_query(raw, query)


def _focus_chunk_text_for_query(text: str, query: str) -> str:
    """
    Focus the text portion of a chunk on keywords.
    Image markers are stripped before focus and re-appended after
    so images are never lost during context trimming.
    """
    raw = str(text or "")

    # Separate image markers from body text before any processing
    images_in_chunk = _extract_images_from_chunk(raw)
    body = _strip_image_markers(raw)

    body = body.split("[medical_aliases]")[0]
    body = re.sub(r"\s{2,}", " ", body)
    body = re.sub(r"\s*\|\s*", " ", body)
    body = body.strip()

    keywords = [k for k in extract_keywords(query).split() if len(k) >= 2]
    if not keywords:
        focused = body[:1400]
    else:
        fragments = re.split(r"(?<=[\.\!\?])\s+|\n+", body)
        matched = [
            f.strip() for f in fragments
            if f.strip() and any(
                re.search(r"\b" + re.escape(k.lower()) + r"\b", f.lower())
                for k in keywords
            )
        ]

        if not matched:
            lowered = body.lower()
            windows: list[str] = []
            for keyword in keywords:
                for m in re.finditer(r"\b" + re.escape(keyword.lower()) + r"\b", lowered):
                    start = max(0, m.start() - 260)
                    end   = min(len(body), m.end() + 260)
                    windows.append(body[start:end].strip())
                    if len(windows) >= 4:
                        break
                if len(windows) >= 4:
                    break
            focused = (" ... ".join(windows) if windows else body[:1000])
            focused = re.sub(r"\s{2,}", " ", focused).strip()[:1100]
        else:
            focused = " ".join(matched)
            focused = re.sub(r"\s{2,}", " ", focused).strip()
            focused = re.split(
                r"\b(Table\s+\d+|SHORT\s+INCUBATION|MEDIUM\s+INCUBATION|"
                r"LONG\s+INCUBATION|Part\s+[IVXLC]+)\b",
                focused, maxsplit=1, flags=re.IGNORECASE,
            )[0].strip()
            sentence_parts = [s.strip() for s in re.split(r"(?<=[\.\!\?])\s+", focused) if s.strip()]
            focused = " ".join(sentence_parts[:3]).strip()[:1100]

    # Re-attach image context as a compact summary (no raw base64 in the prompt)
    image_summary = _build_image_context_for_llm(images_in_chunk)
    return f"{focused}{image_summary}".strip()


def _extract_images_for_response(chunk: dict) -> list[dict]:
    # Build response images directly from inline markers + deterministic S3 key.
    # We do not persist image URLs in DB tables.
    legacy = _extract_images_from_chunk(str(chunk.get("text", "")))
    file_hash = str(chunk.get("file_hash", "")).strip()
    page_num_zero = int(chunk.get("page_num", 0))
    chunk_index = int(chunk.get("chunk_index", 0))
    out = []
    for img in legacy:
        url = ""
        if file_hash:
            url = build_public_image_url(
                file_hash=file_hash,
                page_num=page_num_zero,
                chunk_index=chunk_index,
                img_index=int(img.get("img_index", 0)),
                ext=str(img.get("ext", "png")).lower() or "png",
            )
        out.append({
            **img,
            "url": url,
            "source_file": chunk.get("source_file", "unknown"),
        })
    return [img for img in out if img.get("url")]


def _history_pairs(history: Optional[list]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for item in history or []:
        if isinstance(item, dict):
            role    = str(item.get("Role") or item.get("role") or "").strip().lower()
            content = str(item.get("Content") or item.get("content") or "").strip()
        else:
            role    = str(getattr(item, "role", "")).strip().lower()
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
    user_turns = [content for role, content in turns if role in {"user", "patient"}]
    if not user_turns:
        return latest
    transcript = " ".join(user_turns[-3:])
    return f"{transcript} {latest}".strip()


def _build_cache_query_key(user_query: str) -> str:
    return str(user_query or "").strip()


def _build_query_references(selected: list[dict], book_scope: str) -> list[dict]:
    """
    Distinct (book, page) pairs from chunks sent to the LLM.
    Skips synthetic figure-summary rows. ``page`` is the stored 0-based page index (same as chunk ``page_num``).
    """
    refs: list[dict] = []
    seen: set[tuple[str, int]] = set()
    scope = str(book_scope or "").strip()
    for chunk in selected or []:
        if not isinstance(chunk, dict):
            continue
        if str(chunk.get("chunk_key") or "").strip() == "figure-context-summary":
            continue
        meta_raw = chunk.get("metadata")
        meta = meta_raw if isinstance(meta_raw, dict) else {}
        book = str(meta.get("book_name") or "").strip()
        if not book and scope:
            book = scope
        if not book:
            sf = str(chunk.get("source_file") or "").strip()
            book = sf.rsplit("/", 1)[-1] if sf else ""
        if not book:
            continue
        try:
            page = int(chunk.get("page_num") or 0)
        except (TypeError, ValueError):
            page = 0
        key = (book, page)
        if key in seen:
            continue
        seen.add(key)
        refs.append({"book_name": book, "page": page})
    return refs


def _history_fingerprint(history: Optional[list]) -> str:
    """
    Hash recent dialogue so query-cache entries are not reused across different
    conversation threads or after new assistant turns (same latest user text,
    different context).
    """
    pairs = _history_pairs(history)[-12:]
    if not pairs:
        return hashlib.sha256(b"").hexdigest()
    lines: list[str] = []
    for role, content in pairs:
        lines.append(f"{str(role).strip()}\x1f{str(content).strip()}")
    blob = "\x1e".join(lines).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def _perf_span(trace: Optional[PerfTrace], name: str):
    if trace is None:
        return nullcontext()
    return timed_span(trace, name)


def _apply_perf(trace: Optional[PerfTrace], wall_start: Optional[float], payload: dict) -> dict:
    snap = finalize_perf(trace, wall_start)
    if snap is None:
        return payload
    out = dict(payload)
    out["perf"] = snap
    return out


# ── Main handler ──────────────────────────────────────────────────────────────

async def handle_query(
        user_query: str,
        user_id: str = "",
        user_roles: Optional[List[str]] = None,
        conversation_id: str = "default",
        history: Optional[list] = None,
        *,
        book_name: Optional[str] = None,
        include_outdated_books: bool = False,
        retrieval_question: Optional[str] = None,
        stream_queue: Optional[asyncio.Queue] = None,
) -> dict:
    book_scope = str(book_name or "").strip()
    LOG.info(
        "[RAG][QUERY] user_id=%s conversation_id=%s book_name=%s include_outdated=%s question=%s",
        user_id or "",
        conversation_id or "default",
        book_scope or "",
        include_outdated_books,
        user_query,
    )
    audience = infer_user_audience(user_roles or [])
    rq = str(retrieval_question or "").strip()
    retrieval_seed = rq if rq else user_query
    effective_question = _build_effective_question(retrieval_seed, history)
    cache_query_key = _build_cache_query_key(user_query)
    conv_key = str(conversation_id or "").strip()
    hist_fp = _history_fingerprint(history)

    trace = PerfTrace(operation="query") if PERF_ENABLED else None
    wall_start = time.perf_counter() if PERF_ENABLED else None
    query_t0 = time.perf_counter()
    bind_query_wall_clock(query_t0)

    # ── Cache check ───────────────────────────────────────────────────────────
    cached = get_cached(
        cache_query_key,
        audience=audience,
        user_id=user_id,
        book_name=book_scope,
        include_outdated_books=include_outdated_books,
        conversation_id=conv_key,
        history_fingerprint=hist_fp,
        retrieval_question=rq,
    )
    if cached:
        LOG.info(
            "[RAG][CACHE] hit conversation_id=%s audience=%s question_len=%s",
            conv_key or "default",
            audience,
            len(user_query or ""),
        )
        return await _return_with_stream(
            stream_queue,
            _apply_perf(
                trace,
                wall_start,
                {
                    "answer":              str(cached.get("answer", "")).strip(),
                    "follow_up_questions": cached.get("follow_up_questions", []),
                    "images":              [],
                    "source":              "cache",
                    "reference":           [],
                },
            ),
        )
    LOG.info("[RAG][CACHE] miss question=%s audience=%s", user_query, audience)
    log_timing("T1_after_cache")

    if stream_queue is not None:
        await stream_queue.put(("status", {"phase": "retrieving"}))

    # Safety is cheap; run in parallel with retrieval (embedding dominates T3).
    safety_task = asyncio.create_task(asyncio.to_thread(check_safety, user_query))

    # ── Retrieval ─────────────────────────────────────────────────────────────
    with _perf_span(trace, "keyword_extract"):
        max_chunks = 2 if len(retrieval_seed) < 20 else 3
        allowed_topics = infer_allowed_topics(effective_question)
        LOG.info(
            "[RAG][INTENT] question=%s retrieval_seed=%s allowed_topics=%s audience=%s",
            user_query,
            retrieval_seed,
            allowed_topics,
            audience,
        )
    log_timing("T1b_after_intent")

    used_vector = False
    api_images: list[dict] = []
    chunks: list[dict] = []

    with _perf_span(trace, "db"):
        if is_postgres_persistence() and RAG_USE_VECTOR_RETRIEVAL:
            try:
                from query.vector_retriever import (
                    build_llm_chunks_and_response_images,
                    build_optional_figure_summary_chunk,
                    collect_page_local_images_for_selected_chunks,
                    filter_api_images_by_selected_chunks,
                    retrieve_vector_dual,
                )

                # Definition-style questions should pull all on-topic rows (e.g. criteria tables) even
                # when page_topic_classifier labeled chunks with different `chapter_topic` strings.
                vector_topics = None if _is_broad_definition_query(effective_question) else allowed_topics

                LOG.info(
                    "[RAG][SEARCH_PATH] hyde_enabled=%s path=%s",
                    RAG_ENABLE_HYDE,
                    "hyde" if RAG_ENABLE_HYDE else "legacy_vector",
                )
                if RAG_ENABLE_HYDE:
                    LOG.info("[RAG][HYDE] attempting_hyde_retrieval")
                    if stream_queue is not None:
                        chunks = await asyncio.to_thread(
                            retrieve_hyde_chunks,
                            effective_question,
                            6,
                            True,
                            vector_topics,
                            audience,
                            book_name=book_scope or None,
                            include_outdated_books=include_outdated_books,
                        )
                    else:
                        chunks = retrieve_hyde_chunks(
                            effective_question,
                            top_k=6,
                            include_original_query=True,
                            chapter_topics=vector_topics,
                            audience=audience,
                            book_name=book_scope or None,
                            include_outdated_books=include_outdated_books,
                        )
                    if len(chunks) >= MIN_CHUNKS_REQUIRED:
                        used_vector = True
                        api_images = []
                        LOG.info("[RAG][HYDE] selected_hyde_results text_hits=%s", len(chunks))
                        log_timing("T3d_after_chunk_build", chunks=str(len(chunks)))
                    else:
                        LOG.info(
                            "[RAG][HYDE] insufficient_hyde_results hits=%s min_required=%s fallback=legacy_vector",
                            len(chunks),
                            MIN_CHUNKS_REQUIRED,
                        )

                if not used_vector:
                    LOG.info("[RAG][VECTOR] using_legacy_vector_retrieval")
                    fetch_image_ann = stream_queue is None
                    if stream_queue is not None:
                        text_hits, image_hits = await asyncio.to_thread(
                            retrieve_vector_dual,
                            effective_question,
                            vector_topics,
                            audience,
                            book_name=book_scope or None,
                            include_outdated_books=include_outdated_books,
                            fetch_image_ann=fetch_image_ann,
                        )
                    else:
                        text_hits, image_hits = retrieve_vector_dual(
                            effective_question,
                            chapter_topics=vector_topics,
                            audience=audience,
                            book_name=book_scope or None,
                            include_outdated_books=include_outdated_books,
                            fetch_image_ann=fetch_image_ann,
                        )
                    llm_chunks, api_images = build_llm_chunks_and_response_images(text_hits, image_hits)
                    log_timing("T3d_after_chunk_build", chunks=str(len(llm_chunks)))
                    if len(llm_chunks) >= MIN_CHUNKS_REQUIRED:
                        chunks = llm_chunks
                        used_vector = True
                        LOG.info(
                            "[RAG][RETRIEVE] vector hits text=%s image_pool=%s",
                            len(text_hits),
                            len(image_hits),
                        )
            except Exception as exc:
                LOG.warning("[RAG][SEARCH_PATH] vector_branch_failed fallback=text_retriever error=%s", exc)

        if not used_vector:
            if stream_queue is not None:
                chunks = await asyncio.to_thread(
                    retrieve_top_chunks,
                    effective_question,
                    max_chunks,
                    None,
                    TEXT_SEARCH_MIN_SCORE,
                    allowed_topics,
                    audience,
                    book_name=book_scope or None,
                    include_outdated_books=include_outdated_books,
                )
            else:
                chunks = retrieve_top_chunks(
                    effective_question,
                    top_k=max_chunks,
                    min_score=TEXT_SEARCH_MIN_SCORE,
                    chapter_topics=allowed_topics,
                    audience=audience,
                    book_name=book_scope or None,
                    include_outdated_books=include_outdated_books,
                )

    log_timing("T3_after_retrieval", vector=str(used_vector), chunks=str(len(chunks)))

    safety = await safety_task
    if not safety.safe:
        return await _return_with_stream(
            stream_queue,
            _apply_perf(
                trace,
                wall_start,
                {
                    "answer": safety.reason,
                    "follow_up_questions": [],
                    "images": [],
                    "source": "safety_block",
                    "reference": [],
                },
            ),
        )
    if safety.escalate:
        return await _return_with_stream(
            stream_queue,
            _apply_perf(
                trace,
                wall_start,
                {
                    "answer": "Your symptoms may indicate an emergency. Please call emergency services or visit the nearest hospital immediately.",
                    "follow_up_questions": [],
                    "images": [],
                    "source": "escalation",
                    "reference": [],
                },
            ),
        )
    log_timing("T2_after_safety")
    LOG.info(
        "[RAG][RETRIEVE] question=%s retrieved=%s vector=%s",
        user_query, len(chunks), used_vector,
    )
    if chunks:
        chunk_refs = [
            f"{c.get('source_file','unknown')}#p{c.get('page_num','?')} "
            f"[images={len(c.get('images', []))}]"
            for c in chunks
        ]
        LOG.info("[RAG][RETRIEVE] chunk_refs=%s", chunk_refs)

    if not chunks or len(chunks) < MIN_CHUNKS_REQUIRED:
        LOG.warning("[RAG][INSUFFICIENT] query=%s chunks=%s", user_query, len(chunks))
        return await _return_with_stream(
            stream_queue,
            _apply_perf(
                trace,
                wall_start,
                {
                    "answer":              _insufficient_message_for_audience(audience),
                    "follow_up_questions": [],
                    "images":              [],
                    "source":              "insufficient_chunks",
                    "reference":           [],
                },
            ),
        )

    with _perf_span(trace, "response_format"):
        # Vector path already returns multiple ranked chunks; do not cap at 2–3 or tables vanish.
        context_limit = max_chunks
        if used_vector:
            context_limit = max(max_chunks, MAX_CHUNKS, VECTOR_CONTEXT_MAX_TEXT_CHUNKS)
        selected = assemble_context(chunks, max_chunks=context_limit)
        context_token_count = context_tokens(selected)
        LOG.info(
            "[RAG][CONTEXT] selected=%s context_tokens=%s max=%s",
            len(selected), context_token_count, MAX_CONTEXT_TOKENS,
        )
        if context_token_count > MAX_CONTEXT_TOKENS:
            selected            = trim_chunks(selected)
            context_token_count = context_tokens(selected)
            LOG.info("[RAG][CONTEXT] trimmed selected=%s tokens=%s", len(selected), context_token_count)
        print(f"T4_after_context={time.perf_counter() - query_t0:.3f}s")

        if len(selected) < MIN_CHUNKS_REQUIRED:
            return await _return_with_stream(
                stream_queue,
                {
                    "answer":              _insufficient_message_for_audience(audience),
                    "follow_up_questions": [],
                    "images":              [],
                    "source":              "insufficient_chunks",
                    "reference":           [],
                },
            )
    
        want_token_stream = (
            stream_queue is not None
            and LLM_PROVIDER == "openai"
            and not llm_service._is_flashcard_generation_task(user_query)
        )
        all_response_images: list[dict] = []
        fig_summary_chunk: Optional[dict] = None
        focused_selected: list[dict] = []
        llm_result: dict = {}

        if want_token_stream:
            await stream_queue.put(
                (
                    "ready",
                    {
                        "source": "rag",
                        "images": [],
                        "chunks_used": len(selected),
                    },
                )
            )
            await stream_queue.put(("status", {"phase": "generating"}))
            focused_selected = _build_focused_selected(
                selected, effective_question, used_vector, fig_summary_chunk=None
            )
            print(f"T5_after_focused={time.perf_counter() - query_t0:.3f}s")

            async def _llm_stream_worker() -> dict:
                try:
                    prompt = _build_stream_plain_prompt(
                        user_query, focused_selected, audience
                    )
                    print(f"LLM_CALL_START={time.perf_counter() - query_t0:.3f}s")
                    raw_parts: list[str] = []
                    i = 0
                    first_token_logged = False
                    async for tok in async_iter_openai_chat_stream_tokens(prompt):
                        if not first_token_logged:
                            print(f"FIRST_TOKEN_AT={time.perf_counter() - query_t0:.3f}s")
                            first_token_logged = True
                        raw_parts.append(tok)
                        await stream_queue.put(("delta", tok))
                        if i % 4 == 0:
                            await asyncio.sleep(0)
                        i += 1
                    raw = "".join(raw_parts)
                    return await asyncio.to_thread(
                        finalize_streamed_llm_raw,
                        raw,
                        user_query,
                        focused_selected,
                        audience,
                    )
                except Exception:
                    LOG.exception("[RAG][LLM_STREAM] failed; sync fallback")
                    print(f"LLM_CALL_START={time.perf_counter() - query_t0:.3f}s")
                    result = await asyncio.to_thread(
                        answer_with_context,
                        user_query,
                        focused_selected,
                        audience,
                    )
                    ans_fb = str(result.get("answer", "") or "")
                    step = 160
                    for j in range(0, len(ans_fb), step):
                        if j == 0:
                            print(f"FIRST_TOKEN_AT={time.perf_counter() - query_t0:.3f}s")
                        await stream_queue.put(("delta", ans_fb[j : j + step]))
                        if j % (step * 4) == 0:
                            await asyncio.sleep(0)
                    return result

            llm_result, all_response_images = await asyncio.gather(
                _llm_stream_worker(),
                asyncio.to_thread(
                    _collect_all_response_images, selected, used_vector, api_images
                ),
            )
        else:
            from query.vector_retriever import (
                build_optional_figure_summary_chunk,
                collect_page_local_images_for_selected_chunks,
                filter_api_images_by_selected_chunks,
            )

            filtered_vector_images: list[dict] = []
            seen_image_keys: set[str] = set()

            if RAG_CHAT_INCLUDE_SOURCE_FIGURES:
                if used_vector:
                    filtered_vector_images = collect_page_local_images_for_selected_chunks(
                        selected,
                        page_window=IMAGE_CONTEXT_PAGE_WINDOW,
                        max_return=VECTOR_TOP_K_IMAGE,
                    )
                    if not filtered_vector_images and api_images:
                        filtered_vector_images = filter_api_images_by_selected_chunks(
                            api_images,
                            selected,
                            page_window=IMAGE_CONTEXT_PAGE_WINDOW,
                            max_return=VECTOR_TOP_K_IMAGE,
                        )

                if filtered_vector_images:
                    fig_summary_chunk = build_optional_figure_summary_chunk(
                        filtered_vector_images
                    )

                if used_vector and filtered_vector_images:
                    all_response_images = _images_from_vector_api(filtered_vector_images)
                    seen_image_keys = {
                        str(i.get("url") or "") for i in all_response_images if i.get("url")
                    }
                    for chunk in selected:
                        LOG.info(
                            "[RAG][SELECTED_CHUNK] source=%s page=%s score=%s images=%s text=\n%s",
                            chunk.get("source_file", "unknown"),
                            chunk.get("page_num", "?"),
                            chunk.get("weighted_score", chunk.get("score", "")),
                            0,
                            _chunk_text_for_log(chunk.get("text", "")),
                        )
                else:
                    for chunk in selected:
                        chunk_text_raw = chunk.get("text", "")
                        imgs = _extract_images_for_response(chunk)
                        LOG.info(
                            "[RAG][SELECTED_CHUNK] source=%s page=%s score=%s images=%s text=\n%s",
                            chunk.get("source_file", "unknown"),
                            chunk.get("page_num", "?"),
                            chunk.get("weighted_score", chunk.get("score", "")),
                            len(imgs),
                            _chunk_text_for_log(chunk_text_raw),
                        )
                        for img in imgs:
                            key = f"{chunk.get('page_num')}_{img['img_index']}"
                            if key not in seen_image_keys:
                                seen_image_keys.add(key)
                                all_response_images.append(img)
            else:
                LOG.info(
                    "[RAG][FIGURES] source figures omitted (RAG_CHAT_INCLUDE_SOURCE_FIGURES=false)"
                )
                for chunk in selected:
                    LOG.info(
                        "[RAG][SELECTED_CHUNK] source=%s page=%s score=%s images=%s text=\n%s",
                        chunk.get("source_file", "unknown"),
                        chunk.get("page_num", "?"),
                        chunk.get("weighted_score", chunk.get("score", "")),
                        0,
                        _chunk_text_for_log(chunk.get("text", "")),
                    )

            focused_selected = _build_focused_selected(
                selected, effective_question, used_vector, fig_summary_chunk
            )
            print(f"T5_after_focused={time.perf_counter() - query_t0:.3f}s")

    with _perf_span(trace, "llm"):
        if not want_token_stream:
            print(f"LLM_CALL_START={time.perf_counter() - query_t0:.3f}s")
            llm_result = answer_with_context(
                user_query, focused_selected, audience=audience
            )

    with _perf_span(trace, "response_format"):
        answer             = str(llm_result.get("answer", "")).strip()
        follow_up_questions = llm_result.get("follow_up_questions")
        if not isinstance(follow_up_questions, list):
            follow_up_questions = []

        # ── Cache store ───────────────────────────────────────────────────────────
        if not _is_non_cacheable_answer(answer):
            set_cache(
                cache_query_key,
                answer,
                audience=audience,
                follow_up_questions=follow_up_questions,
                user_id=user_id,
                book_name=book_scope,
                include_outdated_books=include_outdated_books,
                conversation_id=conv_key,
                history_fingerprint=hist_fp,
                retrieval_question=rq,
            )
            LOG.info(
                "[RAG][CACHE] stored conversation_id=%s audience=%s question_len=%s",
                conv_key or "default",
                audience,
                len(user_query or ""),
            )
        else:
            LOG.info("[RAG][CACHE] skipped question=%s", user_query)

        result = {
            "answer":              answer,
            "follow_up_questions": follow_up_questions,
            # ↓ every image from every selected chunk, deduped, ready for the UI
            "images":              all_response_images,
            "source":              "rag",
            "chunks_used":         len(selected),
            "context_tokens":      context_token_count,
            "max_chunks":          context_limit,
            "user_id":             user_id,
            "reference":           _build_query_references(selected, book_scope),
        }
    result = _apply_perf(trace, wall_start, result)
    if stream_queue is not None:
        if want_token_stream:
            await stream_queue.put(("complete", result))
        else:
            await _emit_stream_payload(stream_queue, result)
    return result
