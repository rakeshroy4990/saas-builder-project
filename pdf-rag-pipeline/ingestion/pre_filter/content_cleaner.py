import re

HEADER_FOOTER_PATTERNS = [
    r"(?m)^.{0,60}confidential.{0,60}$",
    r"(?m)^.{0,40}©\s*\d{4}.{0,40}$",
    r"(?m)^.{0,40}all rights reserved.{0,40}$",
    r"(?m)^(page\s+)?\d+\s*(of\s*\d+)?\s*$",
    r"(?m)^(chapter|section)\s+\d+\.?\s*$",
    r"(?m)^\s*(www\.|http)[^\s]+\s*$",
    r"(?m)^[A-Z\s]{5,60}$",
]


def clean_page_text(text: str) -> str:
    clean = text or ""
    for pattern in HEADER_FOOTER_PATTERNS:
        clean = re.sub(pattern, "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\n{3,}", "\n\n", clean)
    return clean.strip()
