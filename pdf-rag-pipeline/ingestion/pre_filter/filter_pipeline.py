from ingestion.pre_filter.content_cleaner import clean_page_text
from ingestion.pre_filter.dedup_filter import deduplicate_pages
from ingestion.pre_filter.page_classifier import should_keep_page


def run_pre_filter(raw_pages: list[str], source_file: str = "") -> list[str]:
    total = len(raw_pages)
    after_classify = [p for p in raw_pages if should_keep_page(p)]
    after_clean = [clean_page_text(p) for p in after_classify]
    after_clean = [p for p in after_clean if len(p.strip()) > 80]
    after_dedup = deduplicate_pages(after_clean)

    dropped_pct = 100 - int((len(after_dedup) / max(total, 1)) * 100)
    print(
        f"[PreFilter] {source_file}: {total} -> classify:{len(after_classify)} "
        f"-> clean:{len(after_clean)} -> dedup:{len(after_dedup)} ({dropped_pct}% dropped)"
    )
    return after_dedup
