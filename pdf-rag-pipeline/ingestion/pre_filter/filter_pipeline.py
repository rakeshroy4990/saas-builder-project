from ingestion.pre_filter.content_cleaner import clean_page_text
from ingestion.pre_filter.dedup_filter import deduplicate_pages
from ingestion.pre_filter.page_classifier import should_keep_page
from ingestion.pre_filter.page_classifier import score_page, DROP_PATTERNS, KEEP_SIGNALS
import re
import statistics

PRE_FILTER_DROP_THRESHOLD = 0.85  # trigger fallback if >85% of pages are dropped

def run_pre_filter(raw_pages: list[str], source_file: str = "") -> tuple[list[str], dict]:
    total = len(raw_pages)
    fallback_used = False
    fallback_reason = None
    DEBUG_SAMPLE = 5  # number of pages to deeply inspect

    # ── Stage 0: Raw page sanity ──────────────────────────────────────────────
    empty_raw = sum(1 for p in raw_pages if not p or not p.strip())
    short_raw  = sum(1 for p in raw_pages if p and 0 < len(p.strip()) < 80)
    print(f"[PreFilter:RAW] {source_file}: total={total}, empty={empty_raw}, <80chars={short_raw}")
    for i, p in enumerate(raw_pages[:DEBUG_SAMPLE]):
        print(f"  [RAW page {i}] len={len(p.strip())} | preview={repr(p.strip()[:120])}")

    # ── Stage 1: Classifier ───────────────────────────────────────────────────
    classify_results = [(p, should_keep_page(p), score_page(p)) for p in raw_pages]
    after_classify   = [p for p, kept, _ in classify_results if kept]
    dropped_by_class = [(i, p, sc) for i, (p, kept, sc) in enumerate(classify_results) if not kept]

    print(f"[PreFilter:CLASSIFY] kept={len(after_classify)}, dropped={len(dropped_by_class)}")
    # Show score distribution of dropped pages
    scores = [sc for _, _, sc in classify_results]
    if scores:
        import statistics
        print(f"  score distribution: min={min(scores):.2f}, max={max(scores):.2f}, "
              f"mean={statistics.mean(scores):.2f}, median={statistics.median(scores):.2f}")
    # Sample a few dropped pages with their scores and which DROP_PATTERNS fired
    for i, p, sc in dropped_by_class[:DEBUG_SAMPLE]:
        fired = [pat for pat in DROP_PATTERNS if re.search(pat, p.strip().lower(), re.IGNORECASE | re.MULTILINE)]
        hits  = [pat for pat in KEEP_SIGNALS  if re.search(pat, p.strip().lower(), re.IGNORECASE)]
        wc    = len(p.split())
        dr    = sum(c.isdigit() for c in p) / max(len(p), 1)
        print(f"  [DROPPED page {i}] score={sc:.2f} | words={wc} | digit_ratio={dr:.2f} "
              f"| drop_pats_fired={len(fired)} | keep_signals_hit={len(hits)}")
        print(f"    drop_patterns : {fired}")
        print(f"    keep_signals  : {hits}")
        print(f"    preview       : {repr(p.strip()[:120])}")

    # ── Stage 2: Clean ────────────────────────────────────────────────────────
    after_clean_raw   = [clean_page_text(p) for p in after_classify]
    dropped_by_clean  = [(i, raw, cl) for i, (raw, cl) in enumerate(zip(after_classify, after_clean_raw))
                         if len(cl.strip()) <= 80]
    after_clean       = [p for p in after_clean_raw if len(p.strip()) > 80]

    print(f"[PreFilter:CLEAN] after_clean={len(after_clean)}, dropped_by_length={len(dropped_by_clean)}")
    for i, raw, cl in dropped_by_clean[:DEBUG_SAMPLE]:
        print(f"  [CLEAN-DROPPED page {i}] raw_len={len(raw.strip())} -> cleaned_len={len(cl.strip())} "
              f"| cleaned_preview={repr(cl.strip()[:120])}")

    # ── Stage 3: Dedup ────────────────────────────────────────────────────────
    after_dedup      = deduplicate_pages(after_clean)
    dropped_by_dedup = len(after_clean) - len(after_dedup)
    print(f"[PreFilter:DEDUP] before={len(after_clean)}, after={len(after_dedup)}, dropped={dropped_by_dedup}")

    # ── Fallback ──────────────────────────────────────────────────────────────
    drop_ratio = 1.0 - (len(after_dedup) / max(total, 1))
    if total > 0 and drop_ratio >= PRE_FILTER_DROP_THRESHOLD:
        print(f"[PreFilter:FALLBACK] triggered — drop_ratio={drop_ratio:.2f}")

        fallback_clean_raw = [clean_page_text(p) for p in raw_pages]
        fallback_clean     = [p for p in fallback_clean_raw if len(p.strip()) > 120]
        print(f"  fallback after clean+length: {len(fallback_clean)} pages survive (threshold >120)")

        # Show why pages are still dying in fallback
        still_dying = [(i, p) for i, p in enumerate(fallback_clean_raw) if len(p.strip()) <= 120]
        print(f"  fallback dropped by length: {len(still_dying)}")
        for i, p in still_dying[:DEBUG_SAMPLE]:
            print(f"    [FALLBACK-DROPPED page {i}] cleaned_len={len(p.strip())} | preview={repr(p.strip()[:120])}")

        fallback_dedup = deduplicate_pages(fallback_clean)
        print(f"  fallback after dedup: {len(fallback_dedup)} pages")

        if fallback_dedup:
            fallback_used   = True
            fallback_reason = "all_dropped" if len(after_dedup) == 0 else f"drop_ratio_{int(drop_ratio * 100)}pct"
            existing        = set(after_dedup)
            recovered       = [p for p in fallback_dedup if p not in existing]
            after_dedup     = after_dedup + recovered
            print(f"  recovered={len(recovered)}, total_after_merge={len(after_dedup)}")
        else:
            print(f"  [FALLBACK FAILED] fallback_dedup is empty — all pages lost after clean+dedup")
            # Last resort: show raw samples to expose the root cause
            print(f"  [FALLBACK FAILED] sampling raw pages to identify root cause:")
            for i, p in enumerate(raw_pages[:DEBUG_SAMPLE]):
                cl = clean_page_text(p)
                print(f"    raw[{i}]: raw_len={len(p.strip())} | cleaned_len={len(cl.strip())} "
                      f"| cleaned_preview={repr(cl.strip()[:120])}")

    # ── Summary ───────────────────────────────────────────────────────────────
    dropped_pct = 100 - int((len(after_dedup) / max(total, 1)) * 100)
    print(f"[PreFilter] {source_file}: {total} -> classify:{len(after_classify)} "
          f"-> clean:{len(after_clean)} -> dedup:{len(after_dedup)} ({dropped_pct}% dropped)")

    stats = {
        "TotalPages": total,
        "ClassifyPages": len(after_classify),
        "CleanPages": len(after_clean),
        "DedupPages": len(after_dedup),
        "DroppedPercent": dropped_pct,
        "FallbackUsed": fallback_used,
        "FallbackReason": fallback_reason,
    }
    return after_dedup, stats