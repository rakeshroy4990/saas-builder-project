"""
Tests for prescription safety validation pipeline.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from prescription.validation_pipeline import (
    check_drug_interactions,
    compute_overall_risk,
    normalize_drug_name,
    parse_dose_mg_from_text,
    parse_frequency_per_day,
    validate_dosage,
)


CATALOG = [
    {
        "generic_name": "Paracetamol",
        "common_brand_names_india": ["Crocin", "Calpol"],
        "search_text": "Paracetamol Crocin Calpol",
    },
    {
        "generic_name": "Amoxicillin-Clavulanate",
        "common_brand_names_india": ["Augmentin", "Advent"],
        "search_text": "Amoxicillin-Clavulanate Augmentin Advent",
    },
    {
        "generic_name": "Domperidone",
        "common_brand_names_india": ["Domstal"],
        "search_text": "Domperidone Domstal",
    },
    {
        "generic_name": "Azithromycin",
        "common_brand_names_india": ["Azithral"],
        "search_text": "Azithromycin Azithral",
    },
]


def test_normalize_crocin_exact_match():
    result = normalize_drug_name("Crocin 250", CATALOG)
    assert result.generic_name == "Paracetamol"
    assert result.method == "exact_match"


def test_normalize_advent_457_maps_to_amox_clav():
    result = normalize_drug_name("Advent 457", CATALOG)
    assert result.generic_name == "Amoxicillin-Clavulanate"
    assert result.method == "exact_match"


def test_strip_numbered_inj_and_syrp_prefixes():
    from prescription.validation_pipeline import _strip_formulation_prefix

    assert _strip_formulation_prefix("1) Inj Hapibev (Inactivated HepB)") == "Hapibev"
    assert _strip_formulation_prefix("2) Inj Influvac Tetra (I)") == "Influvac Tetra"
    assert _strip_formulation_prefix("-> Syrp Calpol 250 3ml SOS if T > 99.5") == "Calpol 250"


def test_normalize_syrp_calpol_maps_to_paracetamol():
    result = normalize_drug_name("-> Syrp Calpol 250 3ml SOS", CATALOG)
    assert result.generic_name == "Paracetamol"
    assert result.matched_brand == "Calpol"


VACCINE_CATALOG = CATALOG + [
    {
        "generic_name": "Hepatitis B Vaccine",
        "drug_class": "vaccine",
        "common_brand_names_india": ["Hapibev", "HepB", "Engerix-B"],
        "search_text": "Hepatitis B Vaccine Hapibev HepB",
    },
    {
        "generic_name": "Influenza Vaccine",
        "drug_class": "vaccine",
        "common_brand_names_india": ["Influvac Tetra", "Influvac", "Vaxigrip"],
        "search_text": "Influenza Vaccine Influvac Tetra Vaxigrip",
    },
]

PROBIOTIC_CATALOG = VACCINE_CATALOG + [
    {
        "generic_name": "Probiotic",
        "drug_class": "probiotic",
        "common_brand_names_india": ["Bifilac", "Vibact", "Biolac"],
        "search_text": "Probiotic Bifilac Vibact Biolac",
    },
    {
        "generic_name": "Cefixime",
        "drug_class": "antibiotic",
        "common_brand_names_india": ["Taxim-O", "Zifi", "Mahacef"],
        "search_text": "Cefixime Taxim-O Zifi Mahacef antibiotic",
    },
]


def test_normalize_opd_vaccines_are_recognized():
    hapibev = normalize_drug_name("1) Inj Hapibev (Inactivated HepB)", VACCINE_CATALOG)
    assert hapibev.generic_name == "Hepatitis B Vaccine"
    assert hapibev.matched_brand == "Hapibev"

    influvac = normalize_drug_name("2) Inj Influvac Tetra (I)", VACCINE_CATALOG)
    assert influvac.generic_name == "Influenza Vaccine"
    assert influvac.matched_brand in {"Influvac Tetra", "Influvac"}


def test_normalize_bifilac_maps_to_probiotic():
    result = normalize_drug_name("Syp Bifilac", PROBIOTIC_CATALOG)
    assert result.generic_name == "Probiotic"
    assert result.matched_brand == "Bifilac"


def test_normalize_cefixime_generic_and_brand():
    generic = normalize_drug_name("Tab Cefixime 100", PROBIOTIC_CATALOG)
    assert generic.generic_name == "Cefixime"

    brand = normalize_drug_name("Syp Taxim-O", PROBIOTIC_CATALOG)
    assert brand.generic_name == "Cefixime"
    assert brand.matched_brand == "Taxim-O"


@patch("prescription.validation_pipeline.get_pool")
def test_validate_cefixime_dosage_when_age_unknown(mock_pool):
    conn = MagicMock()
    cur = MagicMock()
    mock_pool.return_value.connection.return_value.__enter__.return_value = conn
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchone.return_value = {
        "dose_per_kg_mg": 8.0,
        "frequency_per_day_min": 1,
        "frequency_per_day_max": 1,
        "max_single_dose_mg": 400.0,
        "max_daily_dose_mg": 8.0,
        "source": "BNFc 2024",
    }

    finding = validate_dosage("Cefixime", 76.0, 1, "oral", None, 9.6)
    assert finding.status == "within_range"
    assert finding.expected_dose_range_mg is not None
    assert finding.age_appropriate is None


@patch("prescription.validation_pipeline.get_pool")
def test_run_validation_skips_probiotic_dosage(mock_pool):
    from prescription.validation_pipeline import run_prescription_validation

    conn = MagicMock()
    cur = MagicMock()
    mock_pool.return_value.connection.return_value.__enter__.return_value = conn
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchone.return_value = None

    with patch("prescription.validation_pipeline._load_drug_catalog", return_value=PROBIOTIC_CATALOG):
        with patch("prescription.validation_pipeline.check_drug_interactions", return_value=[]):
            with patch("prescription.validation_pipeline.summarize_findings", return_value="ok"):
                result = run_prescription_validation(
                    medications=[{"name": "Syp Bifilac", "route": "oral"}],
                    active_drugs=[],
                    child_age_months=19.0,
                    child_weight_kg=9.6,
                    weight_source="prescription",
                )

    assert result.unrecognized_drugs == []
    assert all(d.generic_name != "Probiotic" for d in result.dosage_findings)


def test_parse_syp_advent_ml_dose_to_mg():
    from prescription.validation_pipeline import _parse_syrup_or_explicit_dose_mg

    dose = _parse_syrup_or_explicit_dose_mg("Syp Advent 457", "4 ml twice a day")
    assert dose is not None
    assert abs(dose - 365.6) < 0.2


def test_normalize_unknown_drug():
    with patch("prescription.validation_pipeline.get_pool") as pool_mock:
        pool_mock.return_value.connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = None
        with patch("prescription.validation_pipeline._llm_assisted_normalize", return_value=None):
            result = normalize_drug_name("XyzNotARealDrug123", CATALOG)
    assert result.generic_name is None
    assert result.method == "not_found"


def test_parse_dose_and_frequency():
    assert parse_dose_mg_from_text("250 mg") == 250.0
    assert parse_frequency_per_day("TDS after food") == 3


def test_validate_dosage_requires_weight():
    finding = validate_dosage("Paracetamol", 180.0, 4, "oral", 24.0, None)
    assert finding.status == "cannot_validate"
    assert "weight" in finding.message.lower()


@patch("prescription.validation_pipeline.get_pool")
def test_check_interactions_canonical_pair(mock_pool):
    conn = MagicMock()
    cur = MagicMock()
    mock_pool.return_value.connection.return_value.__enter__.return_value = conn
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchone.side_effect = [
        {
            "drug_a_generic": "Azithromycin",
            "drug_b_generic": "Domperidone",
            "severity": "moderate",
            "mechanism": "QT",
            "clinical_effect": "Risk",
            "management": "Avoid",
            "source": "BNFc",
        },
        None,
    ]

    findings = check_drug_interactions(["Domperidone"], ["Azithromycin"])
    assert len(findings) == 1
    assert findings[0].severity == "moderate"
    assert findings[0].drugs_from == "across_prescriptions"


def test_compute_overall_risk_critical_for_contraindicated():
    from prescription.validation_pipeline import DosageFinding, InteractionFinding

    interactions = [
        InteractionFinding(
            drug_a="A",
            drug_b="B",
            severity="contraindicated",
            mechanism="",
            clinical_effect="",
            management="",
            source="",
        )
    ]
    assert compute_overall_risk(interactions, [], []) == "critical"


def test_compute_overall_risk_none_when_clean():
    assert compute_overall_risk([], [], []) == "none"
