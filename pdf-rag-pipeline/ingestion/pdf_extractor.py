import fitz
import re
import pytesseract
from PIL import Image
import io

OCR_CHAR_THRESHOLD = 50
MIN_IMG_WIDTH  = 100
MIN_IMG_HEIGHT = 100
MIN_IMG_AREA   = 15_000
MIN_VECTOR_DRAWINGS = 5

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

def is_junk_image(img_bytes: bytes, black_ratio_threshold: float = 0.65) -> bool:
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("L")
        pixels = list(img.getdata())
        black_pixels = sum(1 for p in pixels if p < 50)
        return (black_pixels / len(pixels)) > black_ratio_threshold
    except Exception:
        return False
        
def _ocr_pixmap_bytes(png_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(png_bytes))
    return pytesseract.image_to_string(img, lang="eng")


def extract_pages(filepath: str, include_diagnostics: bool = False):
    pages: list[dict] = []
    ocr_count = 0
    image_diag = {
        "detected_total": 0,
        "kept_total": 0,
        "dropped_total": 0,
        "dropped_reasons": {},
        "vector_candidates_total": 0,
        "vector_kept_total": 0,
        "vector_dropped_total": 0,
        "uploaded_total": 0,
        "upload_failed_total": 0,
    }

    def _drop(reason: str) -> None:
        image_diag["dropped_total"] += 1
        image_diag["dropped_reasons"][reason] = image_diag["dropped_reasons"].get(reason, 0) + 1

    def extract_page_images(doc, page, text_len: int = 0) -> list[dict]:
        images = []
        seen_xrefs = set()
        page_rect = page.rect

        # ── Pass 1: embedded raster images ──────────────────────────────
        for img_info in page.get_images(full=True):
            image_diag["detected_total"] += 1
            xref = img_info[0]
            if xref in seen_xrefs:
                _drop("duplicate_xref")
                continue
            try:
                base_img = doc.extract_image(xref)
                img_w    = base_img.get("width",  0)
                img_h    = base_img.get("height", 0)

                if img_w < MIN_IMG_WIDTH or img_h < MIN_IMG_HEIGHT:
                    _drop("too_small_dimensions")
                    continue
                if img_w * img_h < MIN_IMG_AREA:
                    _drop("too_small_area")
                    continue
                # Ignore full-page scanned background only when page already has enough text.
                if text_len >= OCR_CHAR_THRESHOLD and img_w >= page_rect.width * 0.90 and img_h >= page_rect.height * 0.90:
                    _drop("full_page_background")
                    continue
                if is_junk_image(base_img["image"]):
                    _drop("junk_image_dark")
                    continue

                bbox = page.get_image_bbox(img_info)
                seen_xrefs.add(xref)
                images.append({
                    "data": base_img["image"],
                    "ext":  base_img["ext"],
                    "bbox": (bbox.x0, bbox.y0, bbox.x1, bbox.y1),
                })
                image_diag["kept_total"] += 1
            except Exception:
                _drop("extract_exception")
                continue

        # ── Pass 2: vector diagrams via drawings ─────────────────────────
        drawings = page.get_drawings()
        if len(drawings) >= MIN_VECTOR_DRAWINGS:
            rects = [fitz.Rect(d["rect"]) for d in drawings if d.get("rect")]
            if rects:
                image_diag["vector_candidates_total"] += 1
                combined = rects[0]
                for r in rects[1:]:
                    combined = combined | r

                w = combined.width
                h = combined.height
                page_area = max(page_rect.width * page_rect.height, 1)
                coverage = (w * h) / page_area
                if not (w > MIN_IMG_WIDTH and h > MIN_IMG_HEIGHT and w * h > MIN_IMG_AREA):
                    image_diag["vector_dropped_total"] += 1
                    _drop("vector_too_small")
                elif coverage < 0.08:
                    image_diag["vector_dropped_total"] += 1
                    _drop("vector_low_coverage")
                elif text_len >= OCR_CHAR_THRESHOLD and coverage >= 0.92:
                    image_diag["vector_dropped_total"] += 1
                    _drop("vector_full_page_background")
                else:
                    mat = fitz.Matrix(2, 2)
                    pix = page.get_pixmap(matrix=mat, clip=combined)
                    img_bytes = pix.tobytes("png")
                    if is_junk_image(img_bytes):
                        image_diag["vector_dropped_total"] += 1
                        _drop("vector_junk_image_dark")
                    else:
                        images.append({
                            "data": img_bytes,
                            "ext":  "png",
                            "bbox": (combined.x0, combined.y0, combined.x1, combined.y1),
                        })
                        image_diag["vector_kept_total"] += 1
                        image_diag["kept_total"] += 1

        return images

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

            images = extract_page_images(doc, page, text_len=len(text.strip()))

            if page_num < 5:
                print(f"  [Extract p{page_num}] text_len={len(text.strip())} "
                      f"| raw_imgs={len(page.get_images(full=True))} "
                      f"| kept_imgs={len(images)}")

            pages.append({
                "text":     text,
                "images":   images,
                "page_idx": page_num,
            })

    native = total - ocr_count
    empty  = sum(1 for p in pages if not p["text"].strip())
    print(f"[Extract] {filepath}: {total} pages — {native} native, "
          f"{ocr_count} OCR, {empty} still empty")
    if include_diagnostics:
        return pages, image_diag
    return pages