from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from config.settings import CACHE_TTL_HOURS
from db.mongo_client import get_db


def _cache_key(query: str, audience: str = "") -> str:
    normalized = query.lower().strip()
    scope = str(audience or "").strip().lower()
    payload = f"{scope}::{normalized}" if scope else normalized
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_cached(query: str, audience: str = "") -> Optional[str]:
    doc = get_db().query_cache.find_one({"_id": _cache_key(query, audience)})
    return doc.get("answer") if doc else None


def set_cache(query: str, answer: str, audience: str = "") -> None:
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
                "cached_at": now,
                "expires_at": expires_at,
            }
        },
        upsert=True,
    )


def ensure_cache_ttl_index() -> None:
    get_db().query_cache.create_index("expires_at", expireAfterSeconds=0)
