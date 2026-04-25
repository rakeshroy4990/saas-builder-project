from __future__ import annotations

from typing import Optional

from pymongo import MongoClient

from config.settings import MONGO_DB_NAME, MONGO_URI

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_db():
    return get_client()[MONGO_DB_NAME]
