"""
Marker PDF conversion + lightweight filters for scanned-book noise.
Uses marker-pdf 1.8.x programmatic API (Markdown + paginated pages + extracted images).
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

import fitz
from PIL import Image, ImageOps

from config.settings import (
    MARKER_DISABLE_MULTIPROCESSING,
    MARKER_IMAGE_BLOCKLIST_AHASHES,
    MARKER_IMAGE_BLOCKLIST_HAMMING_MAX,
    MARKER_LOG_IMAGE_AHASH,
    MARKER_USE_LLM,
)

LOG = logging.getLogger(__name__)

PAGE_MARK_RE = re.compile(r"^\{(\d+)\}-+\s*$", re.MULTILINE)

_MARKDOWN_HEADING_LINE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
_FIGURE_CAPTION_START_RE = re.compile(
    r"^\s*(fig(?:ure)?\.?\s*[A-Za-z0-9().-]+\s*[:.)-]?\s*.+)$",
    re.IGNORECASE,
)

MIN_IMG_AREA = 15_000


def extract_segment_heading(segment: str) -> str | None:
    """First markdown heading in a Marker segment (# … through ###### …)."""
    m = _MARKDOWN_HEADING_LINE.search(segment or "")
    if not m:
        return None
    title = (m.group(2) or "").strip()
    title = re.sub(r"\*+", "", title).strip()
    if not title:
        return None
    return title[:512]


def _clean_marker_text_line(line: str) -> str:
    cleaned = str(line or "").strip()
    cleaned = re.sub(r"^[-*+]\s+", "", cleaned)
    cleaned = re.sub(r"^>\s*", "", cleaned)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*(.*?)\*", r"\1", cleaned)
    cleaned = re.sub(r"`(.*?)`", r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_segment_figure_descriptions(segment: str) -> list[str]:
    """
    Pull figure captions/legends from Marker markdown for a single PDF page segment.

    Many textbooks keep figure legends in the page text rather than inside the cropped image
    itself. We preserve those captions separately so images on the same page can reuse them.
    """
    raw_lines = [str(line) for line in str(segment or "").splitlines()]
    out: list[str] = []
    seen: set[str] = set()
    i = 0
    while i < len(raw_lines):
        cleaned = _clean_marker_text_line(raw_lines[i])
        if not cleaned or not _FIGURE_CAPTION_START_RE.match(cleaned):
            i += 1
            continue

        parts = [cleaned]
        j = i + 1
        follow_count = 0
        while j < len(raw_lines) and follow_count < 2:
            nxt = _clean_marker_text_line(raw_lines[j])
            if not nxt:
                break
            if _FIGURE_CAPTION_START_RE.match(nxt):
                break
            if _MARKDOWN_HEADING_LINE.match(raw_lines[j]):
                break
            if nxt.startswith("|"):
                break
            if re.match(r"^(table|box|chapter)\b", nxt, flags=re.IGNORECASE):
                break
            alpha_count = sum(1 for ch in nxt if ch.isalpha())
            if alpha_count < 3:
                break
            parts.append(nxt)
            follow_count += 1
            j += 1

        merged = re.sub(r"\s+", " ", " ".join(parts)).strip()
        if merged:
            key = merged.lower()
            if key not in seen:
                seen.add(key)
                out.append(merged[:420])
        i = j if j > i + 1 else i + 1
    return out
MAX_ASPECT_RATIO = 24.0
JUNK_BLACK_RATIO = 0.92


def _average_hash_u64(img: Image.Image) -> int:
    gray = img.convert("L").resize((8, 8), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    avg = sum(pixels) / len(pixels)
    bits = 0
    for i, p in enumerate(pixels):
        if p >= avg:
            bits |= 1 << i
    return bits


def _hamming_u64(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def _safe_marker_image_filename(name: str) -> str:
    base = str(name).replace("\\", "_").replace("/", "_").replace("..", "_").strip()
    return base if base else "figure"


def split_pdf_page_range(
    src_path: str,
    page_start: int,
    page_end_inclusive: int,
    out_path: str,
) -> None:
    """Write a temporary PDF containing pages [page_start, page_end_inclusive] (0-based)."""
    src = fitz.open(src_path)
    dst = fitz.open()
    try:
        end = min(page_end_inclusive, src.page_count - 1)
        if page_start > end or page_start < 0:
            dst.save(out_path)
            return
        dst.insert_pdf(src, from_page=page_start, to_page=end)
        dst.save(out_path)
    finally:
        dst.close()
        src.close()


def split_paginated_markdown(markdown: str) -> list[tuple[int, str]]:
    """Split Marker output when paginate_output=True ({n}---- separators)."""
    matches = list(PAGE_MARK_RE.finditer(markdown))
    if not matches:
        stripped = (markdown or "").strip()
        return [(0, stripped)] if stripped else []
    segments: list[tuple[int, str]] = []
    for i, m in enumerate(matches):
        rel_page = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        chunk = markdown[start:end].strip()
        if chunk:
            segments.append((rel_page, chunk))
    return segments


def keep_marker_image(path: Path, dropped: dict[str, int]) -> bool:
    """Heuristic drop for decorative strips / huge blank scans."""
    try:
        img = Image.open(path).convert("RGB")
        w, h = img.size
        if w < 16 or h < 16:
            dropped["tiny_dimensions"] = dropped.get("tiny_dimensions", 0) + 1
            return False
        area = w * h
        if area < MIN_IMG_AREA:
            dropped["too_small_area"] = dropped.get("too_small_area", 0) + 1
            return False
        lo = min(w, h)
        hi = max(w, h)
        if lo > 0 and hi / lo > MAX_ASPECT_RATIO:
            dropped["extreme_aspect"] = dropped.get("extreme_aspect", 0) + 1
            return False
        ahash_cache: int | None = None
        if MARKER_IMAGE_BLOCKLIST_AHASHES:
            ahash_cache = _average_hash_u64(img)
            for ref in MARKER_IMAGE_BLOCKLIST_AHASHES:
                if _hamming_u64(ahash_cache, ref) <= MARKER_IMAGE_BLOCKLIST_HAMMING_MAX:
                    dropped["blocklist_ahash"] = dropped.get("blocklist_ahash", 0) + 1
                    if MARKER_LOG_IMAGE_AHASH:
                        LOG.info(
                            "[MarkerImage] dropped blocklist ahash=%016x file=%s",
                            ahash_cache,
                            path.name,
                        )
                    return False
        gray = img.convert("L")
        pixels = list(gray.getdata())
        dark = sum(1 for p in pixels if p < 40)
        if pixels and dark / len(pixels) > JUNK_BLACK_RATIO:
            dropped["mostly_black"] = dropped.get("mostly_black", 0) + 1
            return False
        light = sum(1 for p in pixels if p > 245)
        if pixels and light / len(pixels) > 0.97 and area > 2_500_000:
            dropped["mostly_white_large"] = dropped.get("mostly_white_large", 0) + 1
            return False
        if MARKER_LOG_IMAGE_AHASH:
            hx = ahash_cache if ahash_cache is not None else _average_hash_u64(img)
            LOG.info("[MarkerImage] kept ahash=%016x file=%s", hx, path.name)
        return True
    except Exception:
        dropped["pil_error"] = dropped.get("pil_error", 0) + 1
        return False


def marker_image_crop_suspect(path: Path) -> tuple[bool, str]:
    """
    Best-effort clipped-crop detector for Marker figures.

    A healthy extracted figure usually has some whitespace margin around the crop.
    When content strongly touches one or more image borders, Marker likely cut
    through the original figure and the full PDF page preview is safer to show.
    """
    try:
        img = Image.open(path).convert("L")
        w, h = img.size
        if w < 32 or h < 32:
            return False, ""

        edge_w = max(2, min(24, w // 40))
        edge_h = max(2, min(24, h // 40))
        regions = {
            "left": img.crop((0, 0, edge_w, h)),
            "right": img.crop((w - edge_w, 0, w, h)),
            "top": img.crop((0, 0, w, edge_h)),
            "bottom": img.crop((0, h - edge_h, w, h)),
        }

        def ink_ratio(region: Image.Image) -> float:
            pixels = list(region.getdata())
            if not pixels:
                return 0.0
            return sum(1 for p in pixels if p < 235) / len(pixels)

        ratios = {name: ink_ratio(region) for name, region in regions.items()}
        touching = [name for name, ratio in ratios.items() if ratio >= 0.12]
        heavy = [name for name, ratio in ratios.items() if ratio >= 0.22]

        reasons: list[str] = []
        if len(touching) >= 2:
            reasons.append("multi_edge_content")
        if heavy:
            reasons.append("heavy_edge_content")
        return bool(reasons), ",".join(reasons)
    except Exception:
        return False, ""


def _normalize_marker_ocr_text(raw: str, *, max_chars: int = 420) -> str:
    text = str(raw or "").replace("\x0c", " ")
    lines: list[str] = []
    for line in text.splitlines():
        cleaned = re.sub(r"\s+", " ", line).strip(" |-_:.")
        if not cleaned:
            continue
        alpha_count = sum(1 for ch in cleaned if ch.isalpha())
        if alpha_count < 3:
            continue
        lines.append(cleaned)
    merged = re.sub(r"\s+", " ", " ".join(lines)).strip()
    if not merged:
        return ""
    if len(merged) > max_chars:
        merged = merged[: max_chars - 1].rstrip() + "…"
    return merged


def _is_caption_like_text(text: str) -> bool:
    cleaned = str(text or "").strip()
    if len(cleaned) < 24:
        return False

    tokens = re.findall(r"[A-Za-z][A-Za-z'.-]*", cleaned)
    if len(tokens) < 4:
        return False

    long_tokens = [t for t in tokens if len(t) >= 3]
    vowel_tokens = [t for t in long_tokens if re.search(r"[aeiouy]", t, flags=re.IGNORECASE)]
    single_char_tokens = [t for t in tokens if len(t) == 1]
    alpha_count = sum(1 for ch in cleaned if ch.isalpha())
    non_space_count = sum(1 for ch in cleaned if not ch.isspace())
    alpha_ratio = (alpha_count / non_space_count) if non_space_count else 0.0

    if re.search(r"\b(fig(?:ure)?|chart|graph|measurement|classification|staging|score|algorithm)\b", cleaned, re.I):
        return len(vowel_tokens) >= 3 and alpha_ratio >= 0.55

    if len(vowel_tokens) < 5:
        return False
    if len(long_tokens) < max(4, len(tokens) // 2):
        return False
    if len(single_char_tokens) > max(2, len(tokens) // 3):
        return False
    if alpha_ratio < 0.65:
        return False
    return True


def _ocr_marker_caption_region(img: Image.Image, *, config: str) -> str:
    try:
        import pytesseract
    except Exception:
        return ""
    try:
        gray = ImageOps.autocontrast(img.convert("L"))
        bw = gray.point(lambda p: 255 if p > 180 else 0)
        raw = pytesseract.image_to_string(bw, lang="eng", config=config)
    except Exception:
        return ""
    cleaned = _normalize_marker_ocr_text(raw)
    if not _is_caption_like_text(cleaned):
        return ""
    return cleaned


def extract_marker_image_description(path: Path) -> str:
    """
    OCR the figure caption/legend embedded inside a Marker-extracted image.

    Textbook figures commonly place the legend in the lower part of the image, so we
    prefer OCR from the bottom region and fall back to the full image only when needed.
    """
    try:
        img = Image.open(path).convert("RGB")
    except Exception:
        return ""

    w, h = img.size
    if w < 40 or h < 40:
        return ""

    bottom_crop_h = max(80, int(h * 0.34))
    bottom_region = img.crop((0, max(0, h - bottom_crop_h), w, h))

    candidates = [
        _ocr_marker_caption_region(bottom_region, config="--psm 6"),
        _ocr_marker_caption_region(bottom_region, config="--psm 11"),
        _ocr_marker_caption_region(img, config="--psm 6"),
    ]

    def score(text: str) -> tuple[int, int]:
        cleaned = text.strip()
        return (
            1 if re.search(r"\b(fig|figure)\b", cleaned, flags=re.IGNORECASE) else 0,
            len(cleaned),
        )

    best = max((c for c in candidates if c), key=score, default="")
    if len(best) < 18:
        return ""
    return best


def convert_pdf_with_marker(
    pdf_path: str | Path,
    force_ocr: bool = False,
    *,
    marker_output_base_dir: str,
) -> tuple[str, dict[str, Path], dict]:
    """
    Run Marker on a PDF path. Returns markdown, map name->ephemeral image path, metadata.

    ``marker_output_base_dir`` must be an application-controlled directory (e.g. inside a
    ``tempfile.TemporaryDirectory``). Marker defaults would otherwise write under its package
    ``conversion_results`` folder on disk; we force all artifact paths under this base so nothing
    persists locally beyond the temp scope. Callers upload bytes to S3 and delete files promptly.
    """
    pdf_path = Path(pdf_path)
    base = Path(marker_output_base_dir)
    base.mkdir(parents=True, exist_ok=True)

    opts: dict = {
        "output_format": "markdown",
        "paginate_output": True,
        "output_dir": str(base.resolve()),
    }
    if force_ocr:
        opts["force_ocr"] = True
    if os.getenv("MARKER_DISABLE_IMAGE_EXTRACTION", "").strip().lower() in {"1", "true", "yes"}:
        opts["disable_image_extraction"] = True
    if MARKER_DISABLE_MULTIPROCESSING:
        opts["disable_multiprocessing"] = True

    try:
        from marker.config.parser import ConfigParser
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        from marker.settings import settings as marker_settings
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Marker ingest requires the marker-pdf package (imports 'marker'). "
            "From pdf-rag-pipeline/: pip install -r requirements.txt "
            "or pip install marker-pdf==1.8.0"
        ) from exc

    cfg = ConfigParser(opts)
    marker_config = cfg.generate_config_dict()
    # Marker skips falsy cli_options; omitting use_llm left Gemini-backed processors ambiguous.
    # Explicit False avoids accidental LLM calls/hangs when only GOOGLE_API_KEY is present.
    marker_config["use_llm"] = bool(MARKER_USE_LLM)

    converter = PdfConverter(
        create_model_dict(),
        processor_list=cfg.get_processors(),
        renderer=cfg.get_renderer(),
        llm_service=cfg.get_llm_service(),
        config=marker_config,
    )
    rendered = converter(str(pdf_path))
    markdown = str(getattr(rendered, "markdown", "") or "")
    raw_images = getattr(rendered, "images", None) or {}
    artifact_folder = Path(cfg.get_output_folder(str(pdf_path)))
    meta = getattr(rendered, "metadata", None)
    if hasattr(meta, "model_dump"):
        meta_dict = meta.model_dump()
    elif isinstance(meta, dict):
        meta_dict = meta
    else:
        meta_dict = {}

    fmt_up = (marker_settings.OUTPUT_IMAGE_FORMAT or "PNG").upper()
    pil_fmt = fmt_up if fmt_up in {"PNG", "JPEG", "GIF", "WEBP"} else "JPEG"
    ext_default = "jpg" if pil_fmt == "JPEG" else pil_fmt.lower()

    resolved: dict[str, Path] = {}
    pil_serial = 0
    if isinstance(raw_images, dict):
        for name, val in raw_images.items():
            key = str(name)
            if isinstance(val, Path):
                p = val
                if p.is_file():
                    resolved[key] = p
                continue
            if isinstance(val, Image.Image):
                safe = _safe_marker_image_filename(key)
                if Path(safe).suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
                    safe = f"{safe}.{ext_default}"
                dest = artifact_folder / f"m{pil_serial:04d}_{safe}"
                pil_serial += 1
                dest.parent.mkdir(parents=True, exist_ok=True)
                save_kw: dict = {}
                if pil_fmt == "JPEG":
                    save_kw["quality"] = 92
                val.save(dest, format=pil_fmt, **save_kw)
                resolved[key] = dest
                continue
            try:
                p = Path(val)
            except TypeError:
                LOG.warning("Skipping unrecognized Marker image value type=%s name=%s", type(val), key)
                continue
            if p.is_file():
                resolved[key] = p

    return markdown, resolved, meta_dict
