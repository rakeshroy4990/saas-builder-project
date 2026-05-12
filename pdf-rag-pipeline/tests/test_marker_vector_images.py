from pathlib import Path

from PIL import Image, ImageDraw

from ingestion.marker_worker import (
    _build_marker_image_caption,
    _marker_image_page_hint,
    _page_linked_figure_description,
)
from ingestion.marker_pipeline import (
    _is_caption_like_text,
    _normalize_marker_ocr_text,
    extract_segment_figure_descriptions,
    marker_image_crop_suspect,
)
from query.query_pipeline import _images_from_vector_api
from query import vector_retriever


def test_marker_image_page_hint_uses_relative_page_from_marker_name():
    page_hint, from_name = _marker_image_page_hint(62, 73, "_page_10_Picture_7.jpeg")

    assert page_hint == 72
    assert from_name is True


def test_marker_image_page_hint_falls_back_to_batch_start_when_name_has_no_page():
    page_hint, from_name = _marker_image_page_hint(62, 73, "figure-without-page.jpeg")

    assert page_hint == 62
    assert from_name is False


def test_normalize_marker_ocr_text_keeps_figure_description_lines():
    raw = "\nFig. 2.9: Measurement of mid-upper arm circumference.\n12 34\nNote how landmarks are first located.\n"

    cleaned = _normalize_marker_ocr_text(raw)

    assert cleaned == (
        "Fig. 2.9: Measurement of mid-upper arm circumference "
        "Note how landmarks are first located"
    )


def test_caption_like_text_accepts_real_figure_description():
    text = "Fig. 2.9: Measurement of mid-upper arm circumference. Note how landmarks are first located."

    assert _is_caption_like_text(text) is True


def test_caption_like_text_rejects_noisy_ocr_gibberish():
    text = '% A A AE AY YH a a i "Gq eee'

    assert _is_caption_like_text(text) is False


def test_build_marker_image_caption_appends_image_description():
    caption = _build_marker_image_caption(
        filename="Ghai Essential Pediatrics 10edition.pdf",
        page_hint_img=40,
        image_name="_page_3_Figure_0.jpeg",
        page_hint_from_name=True,
        page_start=37,
        page_end=48,
        image_description="Fig. 2.9: Measurement of mid-upper arm circumference.",
    )

    assert caption == (
        "Medical textbook figure from Ghai Essential Pediatrics 10edition.pdf. "
        "Approximate PDF page 41. Image id: _page_3_Figure_0.jpeg. "
        "Description: Fig. 2.9: Measurement of mid-upper arm circumference."
    )


def test_extract_segment_figure_descriptions_collects_multiline_caption():
    segment = """
    ## Weight

    Some paragraph before figure.
    Fig. 2.3: Beam scale for accurate measurement of weight. The
    child should be nude or in minimal clothing.
    """

    descriptions = extract_segment_figure_descriptions(segment)

    assert descriptions == [
        "Fig. 2.3: Beam scale for accurate measurement of weight. The child should be nude or in minimal clothing."
    ]


def test_page_linked_figure_description_uses_page_id_and_image_order():
    page_descriptions = {
        33: [
            "Fig. 2.3: Beam scale for accurate measurement of weight.",
            "Fig. 2.4: Infant pan balance for neonates.",
        ]
    }
    ordinals: dict[int, int] = {}

    first = _page_linked_figure_description(page_descriptions, 33, ordinals)
    second = _page_linked_figure_description(page_descriptions, 33, ordinals)

    assert first == "Fig. 2.3: Beam scale for accurate measurement of weight."
    assert second == "Fig. 2.4: Infant pan balance for neonates."


def test_collect_page_local_images_for_selected_chunks_uses_selected_file_pages(monkeypatch):
    calls: list[tuple[list[tuple[str, int]], int, int]] = []

    def fake_retrieval_images_near_file_pages(anchors, *, page_window, limit):
        calls.append((list(anchors), page_window, limit))
        return [
            {
                "file_hash": "fh-1",
                "content": "Approximate PDF page 73. Image id: _page_10_Picture_7.jpeg.",
                "source_file": "Ghai Essential Pediatrics 10edition.pdf",
                "page_hint": 72,
                "image_url": "https://example.com/image-72.jpg",
            }
        ]

    monkeypatch.setattr(
        vector_retriever.pg,
        "retrieval_images_near_file_pages",
        fake_retrieval_images_near_file_pages,
    )

    images = vector_retriever.collect_page_local_images_for_selected_chunks(
        [
            {"file_hash": "fh-1", "page_num": 72, "chunk_key": "t-p72-s0-c0"},
            {"file_hash": "fh-1", "page_num": 73, "chunk_key": "t-p73-s1-c0"},
        ],
        page_window=1,
        max_return=4,
    )

    assert calls == [([("fh-1", 72), ("fh-1", 73)], 1, 4)]
    assert images == [
        {
            "url": "https://example.com/image-72.jpg",
            "caption": "Approximate PDF page 73. Image id: _page_10_Picture_7.jpeg.",
            "page_hint": 72,
            "source_file": "Ghai Essential Pediatrics 10edition.pdf",
            "file_hash": "fh-1",
            "page_preview_url": "",
            "crop_suspect": False,
            "crop_suspect_reason": "",
        }
    ]


def test_marker_image_crop_suspect_flags_content_touching_edges(tmp_path: Path):
    path = tmp_path / "clipped.png"
    img = Image.new("RGB", (220, 160), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 22, 150, 138), fill="black")
    img.save(path)

    suspect, reason = marker_image_crop_suspect(path)

    assert suspect is True
    assert reason


def test_images_from_vector_api_uses_page_preview_for_suspect_crop():
    images = _images_from_vector_api(
        [
            {
                "url": "https://example.com/crop.jpg",
                "page_preview_url": "https://example.com/page-41.png",
                "crop_suspect": True,
                "crop_suspect_reason": "multi_edge_content",
                "page_hint": 40,
                "caption": "Medical textbook figure from book. Approximate PDF page 41.",
                "source_file": "Ghai Essential Pediatrics 10edition.pdf",
            }
        ]
    )

    assert images == [
        {
            "img_index": 0,
            "page": 40,
            "ext": "png",
            "caption": (
                "Showing full page preview because the extracted figure may be clipped "
                "(multi_edge_content). Medical textbook figure from book. Approximate PDF page 41."
            ),
            "image_data": "",
            "url": "https://example.com/page-41.png",
            "source_file": "Ghai Essential Pediatrics 10edition.pdf",
        }
    ]
