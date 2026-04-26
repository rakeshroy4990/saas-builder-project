import re

HEADER_FOOTER_PATTERNS = [
    r"(?m)^.{0,60}confidential.{0,60}$",
    r"(?m)^.{0,40}©\s*\d{4}.{0,40}$",
    r"(?m)^.{0,40}all rights reserved.{0,40}$",
    r"(?m)^(page\s+)?\d+\s*(of\s*\d+)?\s*$",
    r"(?m)^(chapter|section)\s+\d+\.?\s*$",
    r"(?m)^\s*(www\.|http)[^\s]+\s*$",
    # Removed the broad [A-Z\s]{5,60} pattern entirely
]


def _strip_running_headers_footers(text: str, n: int = 2) -> str:
    """Remove ALL-CAPS only from first/last n lines — where headers/footers actually live."""
    lines = text.split("\n")
    cap_pattern = re.compile(r"^[A-Z][A-Z\s\-]{3,50}$")

    def maybe_strip(line: str) -> str:
        return "" if cap_pattern.match(line.strip()) else line

    if len(lines) <= n * 2:
        return text  # too short to safely strip anything

    head = [maybe_strip(l) for l in lines[:n]]
    tail = [maybe_strip(l) for l in lines[-n:]]
    middle = lines[n:-n]
    return "\n".join(head + middle + tail)


def clean_page_text(text: str) -> str:
    clean = text or ""
    for pattern in HEADER_FOOTER_PATTERNS:
        clean = re.sub(pattern, "", clean, flags=re.IGNORECASE)
    clean = _strip_running_headers_footers(clean, n=2)
    clean = re.sub(r"\n{3,}", "\n\n", clean)
    return clean.strip()
