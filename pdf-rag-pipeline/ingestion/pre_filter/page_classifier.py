import re

DROP_PATTERNS = [
    r"^(table of contents|contents)\s*$",
    r"^(index|bibliography|references|works cited)\s*$",
    r"^copyright\s+©",
    r"all rights reserved",
    r"^(page\s+\d+\s*of\s*\d+)$",
    r"^(\d+)$",
]

KEEP_SIGNALS = [
    r"\b(treatment|diagnosis|symptom|dosage|therapy|patient|clinical)\b",
    r"\b(procedure|protocol|guideline|indication|contraindication)\b",
    r"\b(drug|medication|prescription|adverse|interaction)\b",
    r"\b(tuberculosis|tb|pneumonia|asthma|dengue|malaria|infection|infectious)\b",
    r"\b(cough|fever|breathlessness|shortness of breath|chest pain|vomiting|diarrhea)\b",
]


def score_page(text: str) -> float:
    text_stripped = (text or "").strip().lower()
    if len(text_stripped) < 80:
        return 0.0

    for pat in DROP_PATTERNS:
        if re.search(pat, text_stripped, re.IGNORECASE | re.MULTILINE):
            return 0.1

    score = 0.5
    signal_hits = sum(1 for pat in KEEP_SIGNALS if re.search(pat, text_stripped, re.IGNORECASE))
    score += signal_hits * 0.1

    word_count = len(text_stripped.split())
    if word_count < 50:
        score -= 0.2
    elif word_count > 200:
        score += 0.1

    digit_ratio = sum(c.isdigit() for c in text_stripped) / max(len(text_stripped), 1)
    if digit_ratio > 0.3:
        score -= 0.2

    return max(0.0, min(1.0, score))


def should_keep_page(text: str, threshold: float = 0.3) -> bool:
    return score_page(text) >= threshold
