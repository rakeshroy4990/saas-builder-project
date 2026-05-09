from ingestion.pre_filter.content_cleaner import clean_page_text
from ingestion.pre_filter.dedup_filter import deduplicate_pages
from ingestion.pre_filter.page_classifier import should_keep_page
from ingestion.pre_filter.page_classifier import score_page, DROP_PATTERNS, KEEP_SIGNALS
import re
import statistics
import hashlib
from typing import TypedDict, Any

PRE_FILTER_DROP_THRESHOLD = 0.85  # trigger fallback if >85% of pages are dropped


# ── Page schema ───────────────────────────────────────────────────────────────
# Every page flowing through the pipeline is a dict with this shape:
#
#   {
#       "text":      str,           # extracted text (may be empty for image-only pages)
#       "images":    list[dict],    # [{"bbox": [...], "data": bytes, "ext": "png"}, ...]
#       "page_idx":  int,           # 0-based original page number
#       "source":    str,           # source filename
#   }
#
# Rules:
#   • A page is "meaningful" if it has substantial text OR at least one image.
#   • Filters/cleaners touch only the "text" key; "images" is always carried forward.
# ─────────────────────────────────────────────────────────────────────────────


def _page_has_images(page: dict) -> bool:
    return bool(page.get("images"))


def _page_text(page: dict) -> str:
    return page.get("text", "")


def _is_meaningful(page: dict, min_text_len: int = 80) -> bool:
    """A page survives if it has enough text OR has at least one image."""
    return len(_page_text(page).strip()) > min_text_len or _page_has_images(page)


def _clean_page(page: dict) -> dict:
    """Clean only the text field; images pass through untouched."""
    return {
        **page,
        "text": clean_page_text(_page_text(page)),   # your existing text cleaner
    }


def _deduplicate_pages(pages: list[dict]) -> list[dict]:
    """
    Dedup on text hash.
    Image-only pages (empty text) are ALL kept — each gets a unique slot
    keyed by page_idx so two genuinely different image pages aren't merged.
    """
    seen: set[str] = set()
    result: list[dict] = []
    for p in pages:
        text = _page_text(p).strip()
        if not text:
            # Image-only page — key by page index so nothing is lost
            key = f"__image_only__{p.get('page_idx', id(p))}"
        else:
            key = hashlib.md5(text.encode()).hexdigest()

        if key not in seen:
            seen.add(key)
            result.append(p)
    return result


# ─────────────────────────────────────────────────────────────────────────────

def run_pre_filter(
    raw_pages: list[dict],          # list of page dicts (text + images)
    source_file: str = "",
) -> tuple[list[dict], dict]:
    """
    Multi-stage pre-filter that preserves images at every step.

    Stages
    ------
    0  Raw sanity check
    1  Classifier  — drop pages whose TEXT is junk (image pages always kept)
    2  Clean       — normalise text; keep page if text > 80 chars OR has images
    3  Dedup       — hash on text; image-only pages keyed by page_idx
    FB Fallback    — if drop_ratio is too high, recover with relaxed thresholds
    """
    total = len(raw_pages)
    fallback_used = False
    fallback_reason = None
    DEBUG_SAMPLE = 5

    # ── Stage 0: Raw page sanity ──────────────────────────────────────────────
    empty_raw = sum(
        1 for p in raw_pages
        if not _page_text(p).strip() and not _page_has_images(p)
    )
    short_raw = sum(
        1 for p in raw_pages
        if _page_text(p) and 0 < len(_page_text(p).strip()) < 80
    )
    img_only = sum(
        1 for p in raw_pages
        if not _page_text(p).strip() and _page_has_images(p)
    )
    print(
        f"[PreFilter:RAW] {source_file}: total={total}, "
        f"empty={empty_raw}, <80chars={short_raw}, image_only={img_only}"
    )
    for i, p in enumerate(raw_pages[:DEBUG_SAMPLE]):
        print(
            f"  [RAW page {i}] text_len={len(_page_text(p).strip())} "
            f"| images={len(p.get('images', []))} "
            f"| preview={repr(_page_text(p).strip()[:120])}"
        )

    # ── Stage 1: Classifier ───────────────────────────────────────────────────
    # Image pages bypass the text classifier entirely — they are always kept.
    classify_results = []
    for p in raw_pages:
        if _page_has_images(p) and not _page_text(p).strip():
            # Pure image page — force keep, score is irrelevant
            classify_results.append((p, True, 1.0))
        else:
            kept = should_keep_page(_page_text(p))
            sc   = score_page(_page_text(p))
            classify_results.append((p, kept, sc))

    after_classify   = [p for p, kept, _ in classify_results if kept]
    dropped_by_class = [(i, p, sc) for i, (p, kept, sc) in enumerate(classify_results) if not kept]

    print(f"[PreFilter:CLASSIFY] kept={len(after_classify)}, dropped={len(dropped_by_class)}")
    scores = [sc for _, _, sc in classify_results]
    if scores:
        print(
            f"  score distribution: min={min(scores):.2f}, max={max(scores):.2f}, "
            f"mean={statistics.mean(scores):.2f}, median={statistics.median(scores):.2f}"
        )
    for i, p, sc in dropped_by_class[:DEBUG_SAMPLE]:
        text = _page_text(p)
        fired = [pat for pat in DROP_PATTERNS if re.search(pat, text.strip().lower(), re.IGNORECASE | re.MULTILINE)]
        hits  = [pat for pat in KEEP_SIGNALS  if re.search(pat, text.strip().lower(), re.IGNORECASE)]
        wc    = len(text.split())
        dr    = sum(c.isdigit() for c in text) / max(len(text), 1)
        print(
            f"  [DROPPED page {i}] score={sc:.2f} | words={wc} | digit_ratio={dr:.2f} "
            f"| drop_pats={len(fired)} | keep_signals={len(hits)} | images={len(p.get('images', []))}"
        )
        print(f"    drop_patterns : {fired}")
        print(f"    keep_signals  : {hits}")
        print(f"    preview       : {repr(text.strip()[:120])}")

    # ── Stage 2: Clean ────────────────────────────────────────────────────────
    after_clean_raw  = [_clean_page(p) for p in after_classify]
    dropped_by_clean = [
        (i, raw, cl)
        for i, (raw, cl) in enumerate(zip(after_classify, after_clean_raw))
        if not _is_meaningful(cl, min_text_len=80)
    ]
    after_clean = [p for p in after_clean_raw if _is_meaningful(p, min_text_len=80)]

    print(
        f"[PreFilter:CLEAN] after_clean={len(after_clean)}, "
        f"dropped_by_length={len(dropped_by_clean)}"
    )
    for i, raw, cl in dropped_by_clean[:DEBUG_SAMPLE]:
        print(
            f"  [CLEAN-DROPPED page {i}] "
            f"raw_text_len={len(_page_text(raw).strip())} -> "
            f"cleaned_text_len={len(_page_text(cl).strip())} "
            f"| images={len(cl.get('images', []))} "
            f"| preview={repr(_page_text(cl).strip()[:120])}"
        )

    # ── Stage 3: Dedup ────────────────────────────────────────────────────────
    after_dedup      = _deduplicate_pages(after_clean)
    dropped_by_dedup = len(after_clean) - len(after_dedup)
    print(
        f"[PreFilter:DEDUP] before={len(after_clean)}, "
        f"after={len(after_dedup)}, dropped={dropped_by_dedup}"
    )

    # ── Fallback ──────────────────────────────────────────────────────────────
    drop_ratio = 1.0 - (len(after_dedup) / max(total, 1))
    if total > 0 and drop_ratio >= PRE_FILTER_DROP_THRESHOLD:
        print(f"[PreFilter:FALLBACK] triggered — drop_ratio={drop_ratio:.2f}")

        fallback_clean_raw = [_clean_page(p) for p in raw_pages]
        # Relaxed threshold: 120 chars for text, but image pages always survive
        fallback_clean = [
            p for p in fallback_clean_raw
            if _is_meaningful(p, min_text_len=120)
        ]
        print(
            f"  fallback after clean+length: {len(fallback_clean)} pages survive "
            f"(text>120 OR has images)"
        )

        still_dying = [
            (i, p) for i, p in enumerate(fallback_clean_raw)
            if not _is_meaningful(p, min_text_len=120)
        ]
        print(f"  fallback dropped by length: {len(still_dying)}")
        for i, p in still_dying[:DEBUG_SAMPLE]:
            print(
                f"    [FALLBACK-DROPPED page {i}] "
                f"cleaned_len={len(_page_text(p).strip())} "
                f"| images={len(p.get('images', []))} "
                f"| preview={repr(_page_text(p).strip()[:120])}"
            )

        fallback_dedup = _deduplicate_pages(fallback_clean)
        print(f"  fallback after dedup: {len(fallback_dedup)} pages")

        if fallback_dedup:
            fallback_used   = True
            fallback_reason = (
                "all_dropped" if len(after_dedup) == 0
                else f"drop_ratio_{int(drop_ratio * 100)}pct"
            )
            existing_keys = {
                hashlib.md5(_page_text(p).encode()).hexdigest()
                if _page_text(p).strip()
                else f"__image_only__{p.get('page_idx', id(p))}"
                for p in after_dedup
            }
            recovered = [
                p for p in fallback_dedup
                if (
                    hashlib.md5(_page_text(p).encode()).hexdigest()
                    if _page_text(p).strip()
                    else f"__image_only__{p.get('page_idx', id(p))}"
                ) not in existing_keys
            ]
            after_dedup = after_dedup + recovered
            print(f"  recovered={len(recovered)}, total_after_merge={len(after_dedup)}")
        else:
            print("[FALLBACK FAILED] all pages lost after clean+dedup")
            for i, p in enumerate(raw_pages[:DEBUG_SAMPLE]):
                cl = _clean_page(p)
                print(
                    f"    raw[{i}]: raw_len={len(_page_text(p).strip())} "
                    f"| cleaned_len={len(_page_text(cl).strip())} "
                    f"| images={len(p.get('images', []))} "
                    f"| preview={repr(_page_text(cl).strip()[:120])}"
                )

    # ── Summary ───────────────────────────────────────────────────────────────
    dropped_pct      = 100 - int((len(after_dedup) / max(total, 1)) * 100)
    img_pages_out    = sum(1 for p in after_dedup if _page_has_images(p))
    text_pages_out   = sum(1 for p in after_dedup if _page_text(p).strip())
    img_only_out     = sum(
        1 for p in after_dedup
        if _page_has_images(p) and not _page_text(p).strip()
    )
    print(
        f"[PreFilter] {source_file}: {total} -> classify:{len(after_classify)} "
        f"-> clean:{len(after_clean)} -> dedup:{len(after_dedup)} "
        f"({dropped_pct}% dropped) | "
        f"text_pages={text_pages_out}, img_pages={img_pages_out}, img_only={img_only_out}"
    )

    stats = {
        "TotalPages":      total,
        "ClassifyPages":   len(after_classify),
        "CleanPages":      len(after_clean),
        "DedupPages":      len(after_dedup),
        "DroppedPercent":  dropped_pct,
        "FallbackUsed":    fallback_used,
        "FallbackReason":  fallback_reason,
        "ImagePages":      img_pages_out,
        "ImageOnlyPages":  img_only_out,
        "TextPages":       text_pages_out,
    }
    return after_dedup, stats