from pymongo import TEXT

from db.mongo_client import get_db


def ensure_text_index() -> None:
    db = get_db()
    db.chunks.create_index(
        [("text", TEXT)],
        name="chunks_text_index",
        default_language="english",
        language_override="language",
        weights={"text": 10},
    )
