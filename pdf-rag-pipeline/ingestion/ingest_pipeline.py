from datetime import datetime, timezone
import re
from config.settings import is_postgres_persistence
from ingestion.chunker import chunk_text as split_into_chunks
from ingestion.page_topic_classifier import classify_chapter_topic
from ingestion.pdf_extractor import extract_pages
from ingestion.pdf_tracker import compute_file_hash, mark_status
from ingestion.pre_filter.filter_pipeline import run_pre_filter
from query.audience_classifier import infer_source_audience
import base64
from datetime import datetime, timezone


def _build_image_caption(img: dict, chapter_topic: str | None, page_num: int) -> str:
    """
    Builds a searchable text caption for an image.
    Extend with OCR / vision model output for richer captions.
    """
    parts = []

    if chapter_topic:
        parts.append(f"Figure related to: {chapter_topic}.")

    parts.append(f"Found on page {page_num + 1}.")

    bbox = img.get("bbox")
    if bbox:
        x0, y0, x1, y1 = bbox
        w, h = x1 - x0, y1 - y0
        ratio = w / h if h else 1
        if ratio > 2.5:
            parts.append("Wide figure — likely a timeline or comparison table.")
        elif ratio < 0.5:
            parts.append("Tall figure — likely a flowchart or architecture diagram.")
        else:
            parts.append("Square figure — likely a chart, graph, or illustration.")

    # TODO: plug in OCR or vision model
    # ocr_text = run_ocr(img["data"])
    # if ocr_text:
    #     parts.append(f"Image text: {ocr_text}")

    return " ".join(parts) if parts else f"Image on page {page_num + 1}."


def _interleave_text_and_images(
    page_text: str,
    page_images: list[dict],
    chapter_topic: str | None,
    orig_page: int,
) -> list[dict]:
    """
    Wraps images into the text at the position they appear on the page
    using bbox Y-coordinate as the anchor.

    Each image becomes an inline marker inside the text:

        ...preceding text...

        [IMAGE:0 | page=3 | Figure related to: Transformers. Wide figure.]
        [IMAGE_DATA:0:iVBORw0KGgoAAAANSUhEUgAA...]

        ...following text...

    The plain-text caption is what gets embedded for search.
    The IMAGE_DATA line carries the raw bytes so the UI can render it.

    Returns a list of text blocks (strings) with images spliced in.
    """
    if not page_images:
        return [{"kind": "text", "content": page_text}]

    # Split text into lines so we can anchor images by vertical position
    lines = page_text.splitlines()
    total_lines = max(len(lines), 1)

    # Map each image to the line index nearest its vertical midpoint
    def image_line_position(img: dict) -> int:
        bbox = img.get("bbox")
        if not bbox:
            return total_lines   # no bbox → append at end
        _, y0, _, y1 = bbox
        mid_y = (y0 + y1) / 2
        # Assume page height ≈ max y1 across all images (fallback 800)
        page_height = max((im["bbox"][3] for im in page_images if im.get("bbox")), default=800)
        frac = mid_y / page_height
        return int(frac * total_lines)

    # Sort images by their vertical position so we insert top-to-bottom
    sorted_images = sorted(enumerate(page_images), key=lambda t: image_line_position(t[1]))

    # Build interleaved block list
    blocks: list[dict] = []
    current_line = 0

    for img_index, img in sorted_images:
        insert_at = image_line_position(img)
        insert_at = max(current_line, min(insert_at, total_lines))

        # Text block before this image
        text_before = "\n".join(lines[current_line:insert_at]).strip()
        if text_before:
            blocks.append({"kind": "text", "content": text_before})

        # Image block — caption is plain text for embedding, data for rendering
        caption = _build_image_caption(img, chapter_topic, orig_page)
        img_b64  = base64.b64encode(img["data"]).decode("utf-8")
        blocks.append({
            "kind":       "image",
            "img_index":  img_index,
            "caption":    caption,
            "image_data": img_b64,
            "image_ext":  img.get("ext", "png"),
            "image_bbox": img.get("bbox"),
            # Inline marker — this is what gets written into the chunk text
            "inline_marker": (
                f"\n\n[IMAGE:{img_index} | page={orig_page + 1} | {caption}]\n"
                f"[IMAGE_DATA:{img_index}:{img_b64}]\n\n"
            ),
        })

        current_line = insert_at

    # Remaining text after the last image
    text_after = "\n".join(lines[current_line:]).strip()
    if text_after:
        blocks.append({"kind": "text", "content": text_after})

    return blocks


def _blocks_to_searchable_text(blocks: list[dict]) -> str:
    """
    Flattens interleaved blocks into a single string.
    Text blocks contribute their content directly.
    Image blocks contribute their inline_marker (caption + base64 data).
    This string is what gets chunked, embedded, and stored.
    """
    parts = []
    for block in blocks:
        if block["kind"] == "text":
            parts.append(block["content"])
        elif block["kind"] == "image":
            parts.append(block["inline_marker"])
    return "\n".join(parts).strip()


def _extract_images_from_chunk(chunk_str: str) -> list[dict]:
    """
    Parses IMAGE_DATA markers back out of a stored chunk string.
    Useful at retrieval time to render images alongside text.

    Returns list of { img_index, image_data (bytes), caption }
    """
    images = []
    # Match [IMAGE:N | page=P | caption] followed by [IMAGE_DATA:N:base64]
    pattern = re.compile(
        r'\[IMAGE:(\d+) \| page=\d+ \| ([^\]]+)\]\n\[IMAGE_DATA:\d+:([A-Za-z0-9+/=]+)\]'
    )
    for match in pattern.finditer(chunk_str):
        img_index = int(match.group(1))
        caption   = match.group(2)
        img_bytes = base64.b64decode(match.group(3))
        images.append({
            "img_index":  img_index,
            "caption":    caption,
            "image_data": img_bytes,
        })
    return images


def process_pdf(filepath: str) -> None:
    file_hash = compute_file_hash(filepath)
    filename  = filepath.split("/")[-1]
    source_audience = infer_source_audience(filename)
    mark_status(file_hash, "processing", filename=filename, filepath=filepath, error=None)
    prefilter_stats: dict = {}

    try:
        raw_pages   = extract_pages(filepath)           # list[dict] with text + images
        clean_pages, prefilter_stats = run_pre_filter(raw_pages, source_file=filename)

        all_chunks: list[dict] = []

        for page_num, page in enumerate(clean_pages):
            page_text   = page.get("text", "").strip()
            page_images = page.get("images", [])
            orig_page   = page.get("page_idx", page_num)

            chapter_topic = classify_chapter_topic(page_text) if page_text else None

            # ── Interleave images into text at their vertical positions ───────
            blocks = _interleave_text_and_images(
                page_text, page_images, chapter_topic, orig_page
            )
            searchable_text = _blocks_to_searchable_text(blocks)

            # ── Chunk the combined text+image string ──────────────────────────
            # chunk_text() splits on token/char limit — images stay with their
            # surrounding text as long as the chunk boundary doesn't cut through
            # an IMAGE marker (add split-protection in chunk_text if needed)
            for chunk_index, chunk in enumerate(split_into_chunks(searchable_text)):
                chunk_str = chunk if isinstance(chunk, str) else chunk.get("text", "")
                # Pull out which images landed in this specific chunk
                images_in_chunk = _extract_images_from_chunk(chunk_str)

                all_chunks.append({
                    "chunk_id":    f"{file_hash}_p{orig_page}_c{chunk_index}",
                    "type":        "mixed" if images_in_chunk else "text",
                    # ↓ full string with inline [IMAGE:…] markers — this is embedded
                    "text": chunk_str,
                    # ↓ images extracted from this chunk for quick UI rendering
                    "images":      [
                        {
                            "img_index":  im["img_index"],
                            "caption":    im["caption"],
                            # store as b64 string for DB portability
                            "image_data": base64.b64encode(im["image_data"]).decode(),
                        }
                        for im in images_in_chunk
                    ],
                    "has_images":  bool(images_in_chunk),
                    "source_file": filename,
                    "file_hash":   file_hash,
                    "page_num":    orig_page,
                    "chunk_index": chunk_index,
                    "metadata": {
                        "chapter_topic": chapter_topic,
                        "audience":      source_audience,
                    },
                    "created_at":  datetime.now(timezone.utc),
                })

        # ── Persist ───────────────────────────────────────────────────────────
        if is_postgres_persistence():
            from db import postgres_backend as pg
            pg.chunks_replace_for_file_hash(file_hash, all_chunks)
        else:
            from db.mongo_client import get_db
            db = get_db()
            db.chunks.delete_many({"file_hash": file_hash})
            if all_chunks:
                db.chunks.insert_many(all_chunks)

        # ── Mark done ─────────────────────────────────────────────────────────
        text_only = sum(1 for c in all_chunks if c["type"] == "text")
        mixed     = sum(1 for c in all_chunks if c["type"] == "mixed")

        mark_status(
            file_hash,
            "processed",
            chunks_count=len(all_chunks),
            text_only_chunks=text_only,
            mixed_chunks=mixed,
            ingested_at=datetime.now(timezone.utc),
            prefilter_stats=prefilter_stats,
        )

    except Exception as exc:
        mark_status(file_hash, "failed", error=str(exc), prefilter_stats=prefilter_stats)
        raise