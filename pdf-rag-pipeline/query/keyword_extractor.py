import re

NOISE_WORDS = {
    "what",
    "is",
    "the",
    "a",
    "an",
    "for",
    "me",
    "can",
    "i",
    "how",
    "does",
    "do",
    "tell",
    "about",
    "give",
    "my",
    "your",
    "on",
    "in",
}


def extract_keywords(query: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", query.lower())
    keywords = [word for word in cleaned.split() if word not in NOISE_WORDS and len(word) > 2]
    return " ".join(keywords) if keywords else query
