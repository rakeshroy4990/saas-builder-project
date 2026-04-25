from ingestion.pre_filter.page_classifier import should_keep_page


def test_short_page_dropped():
    assert should_keep_page("page 10") is False


def test_clinical_page_kept():
    text = "Patient treatment protocol for fever and medication dosage guidance." * 6
    assert should_keep_page(text) is True
