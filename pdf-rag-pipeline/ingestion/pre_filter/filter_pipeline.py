from ingestion.pre_filter.content_cleaner import clean_page_text
from ingestion.pre_filter.dedup_filter import deduplicate_pages
from ingestion.pre_filter.page_classifier import should_keep_page


def run_pre_filter(raw_pages: list[str], source_file: str = "") -> tuple[list[str], dict]:
    total = len(raw_pages)
    after_classify = [p for p in raw_pages if should_keep_page(p)]
    after_clean = [clean_page_text(p) for p in after_classify]
    after_clean = [p for p in after_clean if len(p.strip()) > 80]
    after_dedup = deduplicate_pages(after_clean)
    fallback_used = False

    # Fallback: if classifier is too strict for a document, keep cleaned non-trivial pages
    # so ingestion can still build chunks instead of dropping 100%.
    if total > 0 and len(after_dedup) == 0:
        fallback_clean = [clean_page_text(p) for p in raw_pages]
        fallback_clean = [p for p in fallback_clean if len(p.strip()) > 120]
        fallback_dedup = deduplicate_pages(fallback_clean)
        if fallback_dedup:
            fallback_used = True
            print(
                f"[PreFilterFallback] {source_file}: recovered {len(fallback_dedup)} page(s) "
                f"from raw input after classifier dropped all pages."
            )
            after_dedup = fallback_dedup

    dropped_pct = 100 - int((len(after_dedup) / max(total, 1)) * 100)
    print(
        f"[PreFilter] {source_file}: {total} -> classify:{len(after_classify)} "
        f"-> clean:{len(after_clean)} -> dedup:{len(after_dedup)} ({dropped_pct}% dropped)"
    )
    stats = {
        "TotalPages": total,
        "ClassifyPages": len(after_classify),
        "CleanPages": len(after_clean),
        "DedupPages": len(after_dedup),
        "DroppedPercent": dropped_pct,
        "FallbackUsed": fallback_used,
    }
    return after_dedup, stats
