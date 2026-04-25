import re
from config.domain_points import page_topic_keywords

TOPIC_KEYWORDS = page_topic_keywords()


def classify_chapter_topic(text: str) -> str:
    content = str(text or "").lower()
    if not content:
        return "general"

    best_topic = "general"
    best_score = 0
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            score += len(re.findall(r"\b" + re.escape(keyword) + r"\b", content))
        if score > best_score:
            best_score = score
            best_topic = topic
    return best_topic
