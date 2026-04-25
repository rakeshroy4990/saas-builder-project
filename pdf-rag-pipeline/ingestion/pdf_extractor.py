import fitz
import re


ELSEVIER_WATERMARK_PATTERNS = [
    r"(?im)^.*Downloaded for .*? by Elsevier on .*?$",
    r"(?im)^.*For personal use only\..*?$",
    r"(?im)^.*No other uses without permission\..*?$",
    r"(?im)^.*Copyright ©?\d{4}\.?\s*Elsevier.*$",
]


def clean_pdf_text(text: str) -> str:
    cleaned = str(text or "")
    for pattern in ELSEVIER_WATERMARK_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_pages(filepath: str) -> list[str]:
    pages: list[str] = []
    with fitz.open(filepath) as doc:
        for page in doc:
            pages.append(clean_pdf_text(page.get_text("text") or ""))
    return pages
