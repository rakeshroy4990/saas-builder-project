from __future__ import annotations

from typing import Optional

from pymongo import MongoClient

from config.settings import MONGO_DB_NAME, MONGO_URI, is_postgres_persistence

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_db():
    if is_postgres_persistence():
        raise RuntimeError(
            "MongoDB is disabled when APP_PERSISTENCE_PROVIDER=postgres. "
            "Use postgres-backed modules (db.postgres_backend) instead of get_db()."
        )
    return get_client()[MONGO_DB_NAME]
