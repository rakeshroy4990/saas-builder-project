from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, TypedDict

from config.settings import CACHE_TTL_HOURS
from db.mongo_client import get_db


def _cache_key(query: str, audience: str = "") -> str:
    normalized = query.lower().strip()
    scope = str(audience or "").strip().lower()
    payload = f"{scope}::{normalized}" if scope else normalized
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class CachedQueryResult(TypedDict):
    answer: str
    follow_up_questions: list[str]


def get_cached(query: str, audience: str = "") -> Optional[CachedQueryResult]:
    doc = get_db().query_cache.find_one({"_id": _cache_key(query, audience)})
    if not doc:
        return None
    answer = str(doc.get("answer", "")).strip()
    raw_followups = doc.get("follow_up_questions")
    if isinstance(raw_followups, list):
        follow_up_questions = [
            str(item).strip() for item in raw_followups if str(item).strip()
        ][:6]
    else:
        follow_up_questions = []
    return {"answer": answer, "follow_up_questions": follow_up_questions}


def set_cache(query: str, answer: str, audience: str = "", follow_up_questions: Optional[list[str]] = None) -> None:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=CACHE_TTL_HOURS)
    scope = str(audience or "").strip().lower()
    get_db().query_cache.update_one(
        {"_id": _cache_key(query, audience)},
        {
            "$set": {
                "query": query,
                "audience": scope,
                "answer": answer,
                "follow_up_questions": list(follow_up_questions or []),
                "cached_at": now,
                "expires_at": expires_at,
            }
        },
        upsert=True,
    )


def ensure_cache_ttl_index() -> None:
    get_db().query_cache.create_index("expires_at", expireAfterSeconds=0)
