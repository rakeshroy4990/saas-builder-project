from __future__ import annotations

import re
import logging
from typing import Optional

from config.settings import RAG_LOG_FULL_PROMPT, RAG_LOG_PROMPT_PREVIEW_CHARS, is_postgres_persistence
from config.domain_points import query_aliases
from query.keyword_extractor import SHORT_MEDICAL_TERMS, extract_keywords

LOG = logging.getLogger(__name__)

QUERY_ALIASES = query_aliases()
STOP_QUERY_WORDS = {"i", "have", "a", "an", "the", "is", "am", "are", "was", "were", "to", "of", "and", "or", "in"}

# Match almost every page if used alone in Mongo $text / weighted scoring.
GENERIC_RETRIEVAL_TERMS = {
    "what",
    "when",
    "where",
    "which",
    "who",
    "whom",
    "whose",
    "why",
    "how",
    "signs",
    "sign",
    "symptom",
    "symptoms",
    "treatment",
    "treatments",
    "diagnosis",
    "test",
    "tests",
    "testing",
    "cause",
    "causes",
    "effect",
    "effects",
    "risk",
    "risks",
    "prevention",
    "screening",
    "evaluation",
    "management",
    "disease",
    "diseases",
    "condition",
    "conditions",
    "patient",
    "patients",
    "tell",
    "give",
    "show",
    "list",
    "describe",
    "explain",
    "define",
    "name",
}


def count_occurrences(text: str, word: str) -> int:
    if not text or not word:
        return 0
    pattern = r"\b" + re.escape(word) + r"\b"
    return len(re.findall(pattern, text, flags=re.IGNORECASE))


def _normalize_query_words(query: str) -> list[str]:
    words = [w.strip().lower() for w in re.split(r"\s+", query.lower().strip()) if w.strip()]
    return [w for w in words if w not in STOP_QUERY_WORDS and len(w) >= 2]


def _expanded_terms(query: str, keywords: str) -> list[str]:
    words = _normalize_query_words(query)
    terms = set([t for t in re.split(r"\s+", str(keywords or "").strip()) if t and t.lower() not in STOP_QUERY_WORDS])
    for word in words:
        if word in STOP_QUERY_WORDS:
            continue
        terms.add(word)
        for alias in QUERY_ALIASES.get(word, []):
            terms.add(alias)
    return [t for t in terms if t]


def _term_is_searchable(term: str) -> bool:
    parts = [p for p in term.split() if p]
    if not parts:
        return False
    # Drop noisy terms like "t b" formed from punctuation normalization.
    return all(len(p) >= 2 for p in parts)


def _is_long_form_medical_term(term: str) -> bool:
    t = str(term or "").strip().lower()
    if not t or t in GENERIC_RETRIEVAL_TERMS:
        return False
    if " " in t:
        return True
    return len(t) > 3


def _anchor_terms_for_retrieval(query: str) -> list[str]:
    """
    Substantive tokens for retrieval (exclude generic words like "signs" that appear on unrelated pages).
    """
    raw_kw = extract_keywords(query)
    tokens: list[str] = []
    for t in str(raw_kw or "").split():
        tl = t.lower().strip()
        if not tl or tl in GENERIC_RETRIEVAL_TERMS:
            continue
        if len(tl) < 3:
            continue
        if len(tl) < 4 and tl not in SHORT_MEDICAL_TERMS:
            continue
        tokens.append(tl)
    out: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        if t not in seen:
            seen.add(t)
            out.append(t)
    out.sort(key=len, reverse=True)
    return out[:8]


def _expand_anchors_for_text_search(anchors: list[str]) -> str:
    """Build a Mongo $search string biased toward the user's topic + known aliases."""
    parts: list[str] = []
    seen: set[str] = set()
    for a in anchors:
        for term in [a] + list(QUERY_ALIASES.get(a, [])):
            if not isinstance(term, str):
                continue
            t = re.sub(r"\s+", " ", term.strip().lower())
            if not t or t in seen:
                continue
            if not _term_is_searchable(t):
                continue
            seen.add(t)
            parts.append(t)
            if len(parts) >= 14:
                return " ".join(parts)
    return " ".join(parts)


def _adaptive_min_weighted_score(query: str, expanded_terms: list[str]) -> int:
    q = str(query or "").strip().lower()
    is_short_first_person = len(q.split()) <= 5 and ("i have" in q or "i am" in q or "my " in q)
    if is_short_first_person and expanded_terms:
        return 1
    return 2


def _anchor_hit_body(body_lower: str, anchor: str) -> bool:
    """True if chunk body mentions the anchor or a configured synonym (e.g. chickenpox / varicella)."""
    a = anchor.strip().lower()
    if not a:
        return False
    if count_occurrences(body_lower, a) > 0:
        return True
    for al in QUERY_ALIASES.get(anchor, []):
        if not isinstance(al, str):
            continue
        als = al.strip().lower()
        if not als:
            continue
        if " " in als:
            if als in body_lower:
                return True
        elif count_occurrences(body_lower, als) > 0:
            return True
    # Anchor appears only as a synonym value under another key (e.g. chickenpox listed under varicella).
    for key, vals in QUERY_ALIASES.items():
        if not any(isinstance(v, str) and v.strip().lower() == a for v in vals):
            continue
        if count_occurrences(body_lower, key.lower()) > 0:
            return True
    return False


def _any_anchor_hits_body(body_lower: str, anchors: list[str]) -> bool:
    return any(_anchor_hit_body(body_lower, a) for a in anchors)


def _preview_text(text: str) -> str:
    raw = str(text or "")
    if RAG_LOG_FULL_PROMPT:
        return raw
    preview_chars = max(0, int(RAG_LOG_PROMPT_PREVIEW_CHARS))
    if preview_chars == 0 or len(raw) <= preview_chars:
        return raw
    return raw[:preview_chars] + "... [truncated]"


def score_chunk(chunk: dict, query: str, anchor_terms: Optional[list[str]] = None) -> tuple[int, bool]:
    text = str(chunk.get("text", ""))
    body, _, footer = text.partition("[medical_aliases]")
    body_lower = body.lower()
    footer_lower = footer.lower()
    anchors = anchor_terms if anchor_terms is not None else _anchor_terms_for_retrieval(query)
    if anchors and not _any_anchor_hits_body(body_lower, anchors):
        # Do not rank unrelated pages that only match generic words like "signs".
        return -99, False

    words = [w for w in _normalize_query_words(query) if w not in GENERIC_RETRIEVAL_TERMS]
    if not words:
        words = list(anchors) if anchors else _normalize_query_words(query)
    score = 0
    alias_body_hit = False
    # Reward direct topic-anchor presence (including synonyms like varicella for chickenpox).
    for anchor in anchors:
        if _anchor_hit_body(body_lower, anchor):
            score += 4
            alias_body_hit = True

    for word in words:
        body_occ = count_occurrences(body_lower, word)
        footer_occ = count_occurrences(footer_lower, word)
        if body_occ > 0:
            score += 3 + max(body_occ - 1, 0)
            alias_body_hit = True
        elif footer_occ > 0:
            # Alias-only footer hit has reduced weight.
            score += 1

    # Penalize table-like drug pages that only mention screening terms such as "TB test"
    # but do not discuss the disease topic itself.
    if re.search(r"\btb\s+test\b", body_lower) and "tuberculosis" not in body_lower:
        score -= 2

    # For acronym-led queries, require meaningful long-form hit in body.
    # Apply only to short acronym-like tokens (e.g. tb, dm), not normal disease names.
    for q_word in words:
        if len(q_word) > 4 and q_word not in SHORT_MEDICAL_TERMS:
            continue
        aliases = QUERY_ALIASES.get(q_word, [])
        long_alias_hits = any(
            len(alias) > len(q_word)
            and re.search(r"\b" + re.escape(alias.lower()) + r"\b", body_lower)
            for alias in aliases
        )
        if q_word in QUERY_ALIASES and not long_alias_hits:
            score -= 2

    tags = chunk.get("tags")
    if isinstance(tags, list):
        normalized_tags = {str(tag).strip().lower() for tag in tags}
        if "important" in normalized_tags:
            score += 5
    return score, alias_body_hit


def _run_text_pipeline_backend(
    db,
    match: dict,
    candidate_limit: int,
    min_score: float,
    apply_score_filter: bool,
) -> list[dict]:
    if is_postgres_persistence():
        from db import postgres_backend as pg

        return pg.chunks_text_search(match, candidate_limit, min_score, apply_score_filter)

    assert db is not None
    mongo_db = db
    if apply_score_filter:
        base_pipeline = [
            {"$match": match},
            {"$addFields": {"score": {"$meta": "textScore"}}},
            {"$sort": {"score": -1}},
            {"$limit": candidate_limit},
            {"$project": {"text": 1, "source_file": 1, "page_num": 1, "tags": 1, "metadata": 1, "score": 1, "_id": 0}},
        ]
        pipeline = [base_pipeline[0], base_pipeline[1], {"$match": {"score": {"$gte": min_score}}}] + base_pipeline[2:]
        return list(mongo_db.chunks.aggregate(pipeline))

    base_pipeline = [
        {"$match": match},
        {"$addFields": {"score": {"$meta": "textScore"}}},
        {"$sort": {"score": -1}},
        {"$limit": candidate_limit},
        {"$project": {"text": 1, "source_file": 1, "page_num": 1, "tags": 1, "metadata": 1, "score": 1, "_id": 0}},
    ]
    return list(mongo_db.chunks.aggregate(base_pipeline))


def retrieve_top_chunks(
    query: str,
    top_k: int = 5,
    source_filter: Optional[str] = None,
    min_score: float = 0.5,
    chapter_topics: Optional[list[str]] = None,
    audience: Optional[str] = None,
) -> list[dict]:
    from db.mongo_client import get_db

    db = None if is_postgres_persistence() else get_db()
    keywords = extract_keywords(query)
    expanded_terms = _expanded_terms(query, keywords)
    normalized_terms = [re.sub(r"[^a-zA-Z0-9\s]", " ", t).strip() for t in expanded_terms]
    normalized_terms = [t for t in normalized_terms if t and _term_is_searchable(t)]
    long_form_terms = [t for t in normalized_terms if _is_long_form_medical_term(t)]
    broad_retrieval_query = " ".join(long_form_terms).strip() or " ".join(normalized_terms).strip() or query
    anchor_terms = _anchor_terms_for_retrieval(query)
    anchor_retrieval_query = _expand_anchors_for_text_search(anchor_terms)
    retrieval_query = anchor_retrieval_query or broad_retrieval_query
    LOG.info(
        "[RAG][RETRIEVER] expanded_terms=%s anchor_terms=%s anchor_retrieval=%s broad_retrieval=%s",
        expanded_terms,
        anchor_terms,
        anchor_retrieval_query,
        broad_retrieval_query,
    )

    candidate_limit = max(top_k * 5, 20)

    def build_match(text_search: str) -> dict:
        m: dict = {"$text": {"$search": text_search}}
        if source_filter:
            m["source_file"] = source_filter
        if chapter_topics:
            m["metadata.chapter_topic"] = {"$in": chapter_topics}
        if audience in {"layman", "expert"}:
            m["metadata.audience"] = audience
        return m

    results = _run_text_pipeline_backend(db, build_match(retrieval_query), candidate_limit, min_score, True)
    LOG.info(
        "[RAG][RETRIEVER] query=%s retrieval_query=%s keywords=%s min_score=%s chapter_topics=%s audience=%s candidates_with_score_filter=%s",
        query,
        retrieval_query,
        keywords,
        min_score,
        chapter_topics,
        audience,
        len(results),
    )
    if (
        not results
        and anchor_retrieval_query
        and broad_retrieval_query
        and anchor_retrieval_query.strip() != broad_retrieval_query.strip()
    ):
        LOG.info("[RAG][RETRIEVER] anchor_search_empty_retrying_broad")
        results = _run_text_pipeline_backend(db, build_match(broad_retrieval_query), candidate_limit, min_score, True)
        LOG.info("[RAG][RETRIEVER] after_broad_retry candidates=%s", len(results))
    if not results and (chapter_topics or audience in {"layman", "expert"}):
        # Fallback for old chunks without metadata filters.
        relaxed_match: dict = {"$text": {"$search": retrieval_query}}
        if source_filter:
            relaxed_match["source_file"] = source_filter
        results = _run_text_pipeline_backend(db, relaxed_match, candidate_limit, min_score, True)
        LOG.info(
            "[RAG][RETRIEVER] relaxed_topic_filter candidates_with_score_filter=%s",
            len(results),
        )
    if not results:
        relaxed_no_meta: dict = {"$text": {"$search": retrieval_query}}
        if source_filter:
            relaxed_no_meta["source_file"] = source_filter
        results = _run_text_pipeline_backend(
            db, relaxed_no_meta, candidate_limit, min_score, apply_score_filter=False
        )
        LOG.info("[RAG][RETRIEVER] fallback_without_score_filter candidates=%s", len(results))
    if not results:
        LOG.info("[RAG][RETRIEVER] no candidates after text search; regex fallback disabled")
    for idx, chunk in enumerate(results[:top_k], start=1):
        LOG.info(
            "[RAG][RETRIEVER_RAW_CANDIDATE] index=%s source=%s page=%s text_score=%s text=\n%s",
            idx,
            chunk.get("source_file", "unknown"),
            chunk.get("page_num", "?"),
            chunk.get("score", ""),
            _preview_text(chunk.get("text", "")),
        )

    ranked_candidates = []
    for chunk in results:
        weighted_score, alias_body_hit = score_chunk(chunk, query, anchor_terms)
        ranked_candidates.append({**chunk, "weighted_score": weighted_score, "alias_body_hit": alias_body_hit})
    ranked = sorted(ranked_candidates, key=lambda c: c.get("weighted_score", 0), reverse=True)
    min_weighted_score = _adaptive_min_weighted_score(query, expanded_terms)
    filtered = [chunk for chunk in ranked if chunk.get("weighted_score", 0) >= min_weighted_score]
    if ranked and not filtered:
        for idx, chunk in enumerate(ranked[:top_k], start=1):
            LOG.info(
                "[RAG][RETRIEVER_DROPPED_BY_WEIGHT] index=%s source=%s page=%s text_score=%s weighted_score=%s text=\n%s",
                idx,
                chunk.get("source_file", "unknown"),
                chunk.get("page_num", "?"),
                chunk.get("score", ""),
                chunk.get("weighted_score", ""),
                _preview_text(chunk.get("text", "")),
            )
    LOG.info(
        "[RAG][RETRIEVER] ranked=%s weighted_filtered=%s top_k=%s min_weighted_score=%s",
        len(ranked),
        len(filtered),
        top_k,
        min_weighted_score,
    )
    for idx, chunk in enumerate(filtered[:top_k], start=1):
        LOG.info(
            "[RAG][RETRIEVER_CHUNK] index=%s source=%s page=%s text_score=%s weighted_score=%s alias_body_hit=%s text=\n%s",
            idx,
            chunk.get("source_file", "unknown"),
            chunk.get("page_num", "?"),
            chunk.get("score", ""),
            chunk.get("weighted_score", ""),
            chunk.get("alias_body_hit", False),
            _preview_text(chunk.get("text", "")),
        )
    return filtered[:top_k]
