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
from PIL import Image

from config.settings import (
    MARKER_DISABLE_MULTIPROCESSING,
    MARKER_USE_LLM,
)

LOG = logging.getLogger(__name__)

PAGE_MARK_RE = re.compile(r"^\{(\d+)\}-+\s*$", re.MULTILINE)

MIN_IMG_AREA = 15_000
MAX_ASPECT_RATIO = 24.0
JUNK_BLACK_RATIO = 0.92


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
        return True
    except Exception:
        dropped["pil_error"] = dropped.get("pil_error", 0) + 1
        return False


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
