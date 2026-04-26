import fitz
import re
import fitz
import pytesseract
from PIL import Image
import io

OCR_CHAR_THRESHOLD = 50

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

def _ocr_pixmap_bytes(png_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(png_bytes))
    return pytesseract.image_to_string(img, lang="eng")

def extract_pages(filepath: str) -> list[str]:
    pages: list[str] = []
    ocr_count = 0

    with fitz.open(filepath) as doc:
        total = len(doc)
        for page_num, page in enumerate(doc):
            text = clean_pdf_text(page.get_text("text") or "")

            if len(text.strip()) < OCR_CHAR_THRESHOLD:
                try:
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                    raw_ocr = _ocr_pixmap_bytes(pix.tobytes("png"))
                    text = clean_pdf_text(raw_ocr)
                    ocr_count += 1
                    if page_num % 50 == 0:
                        print(f"  [OCR] {filepath}: page {page_num}/{total} "
                              f"({ocr_count} OCR so far, extracted {len(text)} chars)")
                except Exception as e:
                    print(f"  [OCR ERROR] page {page_num}: {e}")
                    text = ""

            pages.append(text)

    native = total - ocr_count
    empty  = sum(1 for p in pages if not p.strip())
    print(f"[Extract] {filepath}: {total} pages — {native} native, {ocr_count} OCR, {empty} still empty")
    return pages