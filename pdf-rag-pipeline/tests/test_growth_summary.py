from query.growth_summary_pipeline import (
    _trim_summary,
    build_growth_hyde_query,
    fallback_growth_summary,
)


def test_build_growth_hyde_query_includes_measurements():
    query = build_growth_hyde_query(
        age_months=24,
        weight_kg=12.3,
        height_cm=85.0,
        head_circumference_cm=None,
        weight_percentile=45.0,
        height_percentile=60.0,
        bmi_percentile=30.0,
        hc_percentile=None,
    )
    assert "24 months" in query
    assert "12.3 kg" in query
    assert "85 cm" in query
    assert "45th percentile" in query


def test_fallback_summary_typical():
    text = fallback_growth_summary(
        age_months=24,
        weight_kg=12.0,
        height_cm=86.0,
        head_circumference_cm=None,
        weight_percentile=50.0,
        height_percentile=55.0,
        bmi_percentile=48.0,
        hc_percentile=None,
    )
    assert "24 months" in text
    assert "typical" in text.lower()


def test_fallback_summary_low_percentile():
    text = fallback_growth_summary(
        age_months=24,
        weight_kg=12.0,
        height_cm=86.0,
        head_circumference_cm=None,
        weight_percentile=1.0,
        height_percentile=55.0,
        bmi_percentile=48.0,
        hc_percentile=None,
    )
    assert "doctor" in text.lower() or "pediatrician" in text.lower()


def test_trim_summary_keeps_complete_sentence_for_bmi_note():
    raw = (
        "Your child's height is in the 97th percentile and weight is in the 39th percentile, "
        "which is mostly typical; however, please discuss the low BMI percentile with your pediatrician."
    )
    trimmed = _trim_summary(raw)
    assert trimmed.endswith("pediatrician.")
    assert "with your." not in trimmed
