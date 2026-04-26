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
    # Original clinical terms
    r"\b(treatment|diagnosis|symptom|dosage|therapy|patient|clinical)\b",
    r"\b(procedure|protocol|guideline|indication|contraindication)\b",
    r"\b(drug|medication|prescription|adverse|interaction)\b",
    r"\b(tuberculosis|tb|pneumonia|asthma|dengue|malaria|infection|infectious)\b",
    r"\b(cough|fever|breathlessness|shortness of breath|chest pain|vomiting|diarrhea)\b",

    # Anatomy / physiology — common in textbooks
    r"\b(cardiac|renal|hepatic|pulmonary|neurological|gastrointestinal|endocrine)\b",
    r"\b(blood|serum|plasma|urine|stool|sputum|biopsy|culture)\b",
    r"\b(congenital|neonatal|perinatal|prenatal|postnatal|pediatric|paediatric)\b",

    # General medical prose signals
    r"\b(etiology|pathophysiology|epidemiology|prognosis|complications|management)\b",
    r"\b(deficiency|syndrome|disorder|disease|failure|dysfunction)\b",
    r"\b(mg|ml|kg|mcg|iu|units?)\b",        # dosage units in tables
    r"\b(years?|months?|weeks?|days?)\b",    # age ranges — ubiquitous in pediatrics
    r"\b(figure|table|box|chart)\s+\d+",     # cross-references
]


def score_page(text: str) -> float:
    text_stripped = (text or "").strip().lower()
    if len(text_stripped) < 80:
        return 0.0

    drop_hits = sum(1 for pat in DROP_PATTERNS if re.search(pat, text_stripped, re.IGNORECASE | re.MULTILINE))
    if drop_hits >= 3:
        score = 0.1   # clearly junk
        return score
    
    score = 0.5
    if drop_hits >= 1:
        score -= 0.15  # suspicious but let content signals decide

    signal_hits = sum(1 for pat in KEEP_SIGNALS if re.search(pat, text_stripped, re.IGNORECASE))
    score += signal_hits * 0.1

    word_count = len(text_stripped.split())
    if word_count < 20:
        score -= 0.2   # genuinely too sparse
    elif word_count < 50:
        score -= 0.05  # light penalty — could be a table
    elif word_count > 200:
        score += 0.1

    digit_ratio = sum(c.isdigit() for c in text_stripped) / max(len(text_stripped), 1)
    if digit_ratio > 0.3 and signal_hits == 0:
        score -= 0.15  # number-heavy with no medical terms — likely a chart/figure page
    elif digit_ratio > 0.3 and signal_hits > 0:
        pass           # dosage table — don't penalize

    return max(0.0, min(1.0, score))


def should_keep_page(text: str, threshold: float = 0.3) -> bool:
    return score_page(text) >= threshold
