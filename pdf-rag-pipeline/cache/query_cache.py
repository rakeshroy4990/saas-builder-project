from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, TypedDict

from config.settings import CACHE_TTL_HOURS, is_postgres_persistence


def _cache_key(query: str, audience: str = "", user_id: str = "") -> str:
    normalized = query.lower().strip()
    scope = str(audience or "").strip().lower()
    actor = str(user_id or "").strip().lower()
    if scope and actor:
        payload = f"{scope}::{actor}::{normalized}"
    elif scope:
        payload = f"{scope}::{normalized}"
    elif actor:
        payload = f"{actor}::{normalized}"
    else:
        payload = normalized
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class CachedQueryResult(TypedDict):
    answer: str
    follow_up_questions: list[str]


def get_cached(query: str, audience: str = "", user_id: str = "") -> Optional[CachedQueryResult]:
    key = _cache_key(query, audience, user_id)
    if is_postgres_persistence():
        from db import postgres_backend as pg

        row = pg.query_cache_find_one(key)
        if not row:
            return None
        answer = str(row.get("answer", "")).strip()
        follow_up_questions = row.get("follow_up_questions") or []
        if not isinstance(follow_up_questions, list):
            follow_up_questions = []
        return {"answer": answer, "follow_up_questions": follow_up_questions}

    from db.mongo_client import get_db

    doc = get_db().query_cache.find_one({"_id": key})
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


def set_cache(
    query: str,
    answer: str,
    audience: str = "",
    follow_up_questions: Optional[list[str]] = None,
    user_id: str = "",
) -> None:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=CACHE_TTL_HOURS)
    scope = str(audience or "").strip().lower()
    actor = str(user_id or "").strip()
    key = _cache_key(query, audience, actor)

    if is_postgres_persistence():
        from db import postgres_backend as pg

        pg.query_cache_upsert(
            key,
            query,
            scope,
            actor,
            answer,
            list(follow_up_questions or []),
            now,
            expires_at,
        )
        return

    from db.mongo_client import get_db

    get_db().query_cache.update_one(
        {"_id": key},
        {
            "$set": {
                "query": query,
                "audience": scope,
                "user_id": actor,
                "logged_in_user_id": actor,
                "answer": answer,
                "follow_up_questions": list(follow_up_questions or []),
                "cached_at": now,
                "expires_at": expires_at,
            }
        },
        upsert=True,
    )


def ensure_cache_ttl_index() -> None:
    if is_postgres_persistence():
        # TTL is enforced in query_cache_find_one (expires_at > now()). Optional: periodic DELETE job.
        return
    from db.mongo_client import get_db

    get_db().query_cache.create_index("expires_at", expireAfterSeconds=0)
