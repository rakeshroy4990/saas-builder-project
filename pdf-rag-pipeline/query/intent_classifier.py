import re
from typing import List, Optional

from config.domain_points import intent_keywords

TOPIC_INTENT_KEYWORDS = intent_keywords()


def infer_allowed_topics(query: str) -> Optional[List[str]]:
    q = str(query or "").lower()
    if not q:
        return None
    scores: dict[str, int] = {}
    for topic, keywords in TOPIC_INTENT_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            score += len(re.findall(r"\b" + re.escape(keyword) + r"\b", q))
        if score > 0:
            scores[topic] = score
    if not scores:
        return None
    max_score = max(scores.values())
    if max_score <= 0:
        return None
    return [topic for topic, score in scores.items() if score == max_score]
