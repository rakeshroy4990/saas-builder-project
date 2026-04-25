from __future__ import annotations

from typing import Optional

from db.mongo_client import get_db
from query.keyword_extractor import extract_keywords


def retrieve_top_chunks(
    query: str,
    top_k: int = 5,
    source_filter: Optional[str] = None,
    min_score: float = 0.5,
) -> list[dict]:
    db = get_db()
    keywords = extract_keywords(query)

    match: dict = {"$text": {"$search": keywords}}
    if source_filter:
        match["source_file"] = source_filter

    base_pipeline = [
        {"$match": match},
        {"$addFields": {"score": {"$meta": "textScore"}}},
        {"$sort": {"score": -1}},
        {"$limit": top_k},
        {"$project": {"text": 1, "source_file": 1, "page_num": 1, "score": 1, "_id": 0}},
    ]

    with_filter = [base_pipeline[0], base_pipeline[1], {"$match": {"score": {"$gte": min_score}}}] + base_pipeline[2:]
    results = list(db.chunks.aggregate(with_filter))
    if results:
        return results
    return list(db.chunks.aggregate(base_pipeline))
