"""
Prescription safety validation — normalization, interaction lookup, dosage checks.
LLM is used ONLY for constrained name matching and summarizing pre-computed findings.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from itertools import combinations
from typing import Any, Literal, Optional

import httpx
from openai import OpenAI
from psycopg.rows import dict_row

from config.settings import OPENAI_API_KEY
from db.postgres_backend import get_pool

LOG = logging.getLogger(__name__)

FUZZY_THRESHOLD = float(os.getenv("DRUG_NORMALIZATION_FUZZY_THRESHOLD", "0.6"))
SUMMARY_MODEL = "gpt-4o-mini"

_openai_client: OpenAI | None = None

NormalizationMethod = Literal["exact_match", "fuzzy_match", "llm_assisted", "not_found"]
InteractionSeverity = Literal["contraindicated", "major", "moderate", "minor"]
DosageStatus = Literal["within_range", "below_range", "above_range", "cannot_validate"]
RiskLevel = Literal["none", "low", "moderate", "high", "critical"]
DrugsFrom = Literal["same_prescription", "across_prescriptions"]


def _client() -> OpenAI | None:
    global _openai_client
    if not OPENAI_API_KEY:
        return None
    if _openai_client is None:
        _openai_client = OpenAI(
            api_key=OPENAI_API_KEY,
            http_client=httpx.Client(
                limits=httpx.Limits(max_connections=4, max_keepalive_connections=2, keepalive_expiry=30)
            ),
        )
    return _openai_client


@dataclass
class NormalizationResult:
    extracted_name: str
    generic_name: str | None = None
    matched_brand: str | None = None
    confidence: float = 0.0
    method: NormalizationMethod = "not_found"


@dataclass
class InteractionFinding:
    drug_a: str
    drug_b: str
    severity: InteractionSeverity
    mechanism: str
    clinical_effect: str
    management: str
    source: str
    drugs_from: DrugsFrom = "same_prescription"


@dataclass
class DosageFinding:
    generic_name: str
    status: DosageStatus
    prescribed_dose_mg: float | None = None
    expected_dose_range_mg: tuple[float, float] | None = None
    prescribed_daily_total_mg: float | None = None
    max_safe_daily_mg: float | None = None
    age_appropriate: bool | None = None
    message: str = ""


@dataclass
class ValidationResult:
    overall_risk_level: RiskLevel = "none"
    interaction_findings: list[InteractionFinding] = field(default_factory=list)
    dosage_findings: list[DosageFinding] = field(default_factory=list)
    unrecognized_drugs: list[str] = field(default_factory=list)
    weight_source: str = "not_available"
    llm_summary: str = ""


def _canonical_pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


_LINE_PREFIX = re.compile(
    r"^\s*(?:(?:\d+\s*[.)]\s*)|(?:[-–—•*>]+\s*)|(?:->|→)\s*)+",
    re.IGNORECASE,
)
_FORMULATION_PREFIX = re.compile(
    r"^\s*(?:syp\.?|syrp\.?|syr\.?|syrup|tab\.?|cap\.?|susp\.?|suspension|inj\.?|injection|drops?|oint\.?|cream|gel|dt\.?|sachet|sach\.?)\s+",
    re.IGNORECASE,
)
_TRAILING_DOSE = re.compile(r"\s+(?:\d+(?:\.\d+)?\s*ml\b.*|(?:sos|prn|stat)\b.*)$", re.IGNORECASE)
_ORAL_REHYDRATION = re.compile(r"(?:\bors\b|oral\s+rehydrat|rehydration\s+sachet|oral\s+rachet|oral\s+sachet)", re.IGNORECASE)


def _strip_formulation_prefix(name: str) -> str:
    raw = (name or "").strip()
    if not raw:
        return ""
    if _ORAL_REHYDRATION.search(raw):
        return "ORS"
    line_prefix = _LINE_PREFIX.match(raw)
    if line_prefix:
        raw = raw[line_prefix.end() :].strip()
    paren = raw.find("(")
    if paren > 0:
        raw = raw[:paren].strip()
    colon = raw.find(":")
    if 0 < colon < 40:
        raw = raw[:colon].strip()
    match = _FORMULATION_PREFIX.match(raw)
    if match:
        raw = raw[match.end() :].strip()
    trailing = _TRAILING_DOSE.search(raw)
    if trailing:
        raw = raw[: trailing.start()].strip()
    raw = re.sub(r"(?i)\b(?:few|some|one|two|\d+)\s+(?=\w)", "", raw).strip()
    return raw or name.strip()


def _load_drug_catalog() -> list[dict[str, Any]]:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT generic_name, drug_class, common_brand_names_india, search_text
                FROM drug_reference
                WHERE deleted = false
                ORDER BY generic_name
                """
            )
            return list(cur.fetchall())


def _drug_class_for_generic(catalog: list[dict[str, Any]], generic_name: str) -> str:
    for row in catalog:
        if str(row.get("generic_name") or "") == generic_name:
            return str(row.get("drug_class") or "").strip().lower()
    return ""


def _is_vaccine_generic(catalog: list[dict[str, Any]], generic_name: str) -> bool:
    return _drug_class_for_generic(catalog, generic_name) == "vaccine"


def _skip_weight_based_dosage_validation(catalog: list[dict[str, Any]], generic_name: str) -> bool:
    """Vaccines and probiotics use schedule/count dosing — not mg/kg reference tables."""
    return _drug_class_for_generic(catalog, generic_name) in {"vaccine", "probiotic"}


def normalize_drug_name(extracted_name: str, catalog: list[dict[str, Any]] | None = None) -> NormalizationResult:
    raw = _strip_formulation_prefix((extracted_name or "").strip())
    if not raw:
        return NormalizationResult(extracted_name=extracted_name or "", method="not_found")

    needle = raw.lower()
    rows = catalog if catalog is not None else _load_drug_catalog()

    def _match_catalog(candidate: str) -> NormalizationResult | None:
        cand = candidate.lower().strip()
        if not cand:
            return None
        for row in rows:
            generic = str(row["generic_name"])
            if cand == generic.lower():
                return NormalizationResult(
                    extracted_name=raw,
                    generic_name=generic,
                    confidence=1.0,
                    method="exact_match",
                )
            for brand in row.get("common_brand_names_india") or []:
                brand_s = str(brand).strip()
                if brand_s and cand == brand_s.lower():
                    return NormalizationResult(
                        extracted_name=raw,
                        generic_name=generic,
                        matched_brand=brand_s,
                        confidence=1.0,
                        method="exact_match",
                    )
                if brand_s and brand_s.lower() in cand:
                    return NormalizationResult(
                        extracted_name=raw,
                        generic_name=generic,
                        matched_brand=brand_s,
                        confidence=0.95,
                        method="exact_match",
                    )
        return None

    for candidate in (needle, re.sub(r"\s+\d{2,4}$", "", needle).strip()):
        hit = _match_catalog(candidate)
        if hit:
            return hit

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT generic_name, similarity(search_text, %s) AS score
                FROM drug_reference
                WHERE deleted = false AND similarity(search_text, %s) > %s
                ORDER BY score DESC
                LIMIT 1
                """,
                (raw, raw, FUZZY_THRESHOLD),
            )
            hit = cur.fetchone()
    if hit:
        return NormalizationResult(
            extracted_name=raw,
            generic_name=str(hit["generic_name"]),
            confidence=float(hit["score"]),
            method="fuzzy_match",
        )

    llm_match = _llm_assisted_normalize(raw, rows)
    if llm_match:
        return NormalizationResult(
            extracted_name=raw,
            generic_name=llm_match,
            confidence=0.7,
            method="llm_assisted",
        )

    return NormalizationResult(extracted_name=raw, method="not_found")


def _llm_assisted_normalize(extracted_name: str, catalog: list[dict[str, Any]]) -> str | None:
    client = _client()
    if client is None or not catalog:
        return None

    known: list[str] = []
    allowed = set()
    for row in catalog:
        generic = str(row["generic_name"])
        allowed.add(generic.lower())
        brands = ", ".join(str(b) for b in (row.get("common_brand_names_india") or []))
        known.append(f"{generic} (brands: {brands})")

    system = (
        "You match a possibly-misspelled or brand-name drug from an Indian prescription to its generic name. "
        "Here is the list of known drugs:\n"
        + "\n".join(known[:60])
        + "\nIf the input matches one of these (allowing OCR errors or brand names), return ONLY the generic name. "
        "If it does not match ANY drug in this list, return exactly: null"
    )
    try:
        response = client.chat.completions.create(
            model=SUMMARY_MODEL,
            temperature=0,
            max_tokens=40,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": extracted_name},
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        if text.lower() in {"null", "none", ""}:
            return None
        for row in catalog:
            if text.lower() == str(row["generic_name"]).lower():
                return str(row["generic_name"])
    except Exception:
        LOG.warning("llm_assisted_normalize_failed", exc_info=True)
    return None


def check_drug_interactions(
    normalized_current: list[str],
    active_drugs: list[str],
) -> list[InteractionFinding]:
    all_drugs = sorted({d for d in normalized_current + active_drugs if d})
    if len(all_drugs) < 2:
        return []

    current_set = set(normalized_current)
    pairs = [_canonical_pair(a, b) for a, b in combinations(all_drugs, 2)]
    if not pairs:
        return []

    pool = get_pool()
    findings: list[InteractionFinding] = []
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            for drug_a, drug_b in pairs:
                cur.execute(
                    """
                    SELECT drug_a_generic, drug_b_generic, severity, mechanism, clinical_effect, management, source
                    FROM drug_interactions
                    WHERE deleted = false AND drug_a_generic = %s AND drug_b_generic = %s
                    """,
                    (drug_a, drug_b),
                )
                row = cur.fetchone()
                if not row:
                    continue
                drugs_from: DrugsFrom = (
                    "same_prescription"
                    if drug_a in current_set and drug_b in current_set
                    else "across_prescriptions"
                )
                findings.append(
                    InteractionFinding(
                        drug_a=str(row["drug_a_generic"]),
                        drug_b=str(row["drug_b_generic"]),
                        severity=row["severity"],
                        mechanism=str(row.get("mechanism") or ""),
                        clinical_effect=str(row.get("clinical_effect") or ""),
                        management=str(row.get("management") or ""),
                        source=str(row.get("source") or ""),
                        drugs_from=drugs_from,
                    )
                )
    return findings


@dataclass
class RecommendedDosageResult:
    extracted_name: str
    generic_name: str | None
    status: Literal["available", "drug_not_found", "weight_required", "no_reference"]
    child_weight_kg: float | None = None
    child_age_months: float | None = None
    route: str = "oral"
    dose_per_kg_mg: float | None = None
    expected_dose_range_mg: tuple[float, float] | None = None
    max_single_dose_mg: float | None = None
    max_daily_dose_mg: float | None = None
    frequency_per_day_min: int | None = None
    frequency_per_day_max: int | None = None
    source: str | None = None
    message: str = ""


def _load_dosage_reference(
    generic_name: str,
    route: str,
    child_age_months: float | None,
) -> dict[str, Any] | None:
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            if child_age_months is None or child_age_months <= 0:
                cur.execute(
                    """
                    SELECT *
                    FROM pediatric_dosage_reference
                    WHERE deleted = false
                      AND generic_name = %s
                      AND route = %s
                    ORDER BY min_age_months ASC
                    LIMIT 1
                    """,
                    (generic_name, route),
                )
            else:
                cur.execute(
                    """
                    SELECT *
                    FROM pediatric_dosage_reference
                    WHERE deleted = false
                      AND generic_name = %s
                      AND route = %s
                      AND %s BETWEEN min_age_months AND max_age_months
                    ORDER BY min_age_months DESC
                    LIMIT 1
                    """,
                    (generic_name, route, int(child_age_months)),
                )
            return cur.fetchone()


def _compute_expected_ranges(
    ref: dict[str, Any],
    child_weight_kg: float,
) -> tuple[tuple[float, float] | None, float | None, float | None]:
    dose_per_kg = ref.get("dose_per_kg_mg")
    max_single = ref.get("max_single_dose_mg")
    max_daily_ref = ref.get("max_daily_dose_mg")
    expected_range: tuple[float, float] | None = None
    max_safe_daily: float | None = None
    if dose_per_kg is not None:
        expected = float(dose_per_kg) * float(child_weight_kg)
        cap_single = float(max_single) if max_single is not None else expected * 1.5
        expected_range = (expected * 0.8, min(expected * 1.2, cap_single))
        if max_daily_ref is not None:
            max_safe_daily = float(max_daily_ref) * float(child_weight_kg)
    elif max_single is not None:
        expected_range = (float(max_single) * 0.8, float(max_single))
        max_safe_daily = float(max_daily_ref) if max_daily_ref is not None else None
    return expected_range, max_safe_daily, float(max_single) if max_single is not None else None


def recommend_pediatric_dosage(
    drug_name: str,
    child_age_months: float,
    child_weight_kg: float | None,
    route: str = "oral",
) -> RecommendedDosageResult:
    catalog = _load_drug_catalog()
    norm = normalize_drug_name(drug_name, catalog)
    route_norm = (route or "oral").strip().lower()
    if not norm.generic_name:
        return RecommendedDosageResult(
            extracted_name=drug_name,
            generic_name=None,
            status="drug_not_found",
            message="Drug not found in reference catalog. Try generic or common Indian brand name.",
        )
    if child_weight_kg is None:
        return RecommendedDosageResult(
            extracted_name=drug_name,
            generic_name=norm.generic_name,
            status="weight_required",
            child_age_months=child_age_months,
            route=route_norm,
            message="Child weight is required to compute weight-based dose ranges.",
        )
    ref = _load_dosage_reference(norm.generic_name, route_norm, child_age_months)
    if not ref:
        return RecommendedDosageResult(
            extracted_name=drug_name,
            generic_name=norm.generic_name,
            status="no_reference",
            child_weight_kg=child_weight_kg,
            child_age_months=child_age_months,
            route=route_norm,
            message="No pediatric dosage reference for this drug, route, and age.",
        )
    expected_range, max_safe_daily, max_single = _compute_expected_ranges(ref, float(child_weight_kg))
    dose_per_kg = ref.get("dose_per_kg_mg")
    freq_min = ref.get("frequency_per_day_min")
    freq_max = ref.get("frequency_per_day_max")
    msg_parts = [f"Reference dosing for {norm.generic_name} ({child_weight_kg}kg, {int(child_age_months)} months)."]
    if expected_range:
        lo, hi = expected_range
        msg_parts.append(f"Typical single dose: {lo:.0f}–{hi:.0f} mg per dose.")
    if max_safe_daily is not None:
        msg_parts.append(f"Max safe daily total: about {max_safe_daily:.0f} mg/day.")
    if freq_min and freq_max:
        msg_parts.append(f"Frequency: {freq_min}–{freq_max} times per day.")
    return RecommendedDosageResult(
        extracted_name=drug_name,
        generic_name=norm.generic_name,
        status="available",
        child_weight_kg=float(child_weight_kg),
        child_age_months=child_age_months,
        route=route_norm,
        dose_per_kg_mg=float(dose_per_kg) if dose_per_kg is not None else None,
        expected_dose_range_mg=expected_range,
        max_single_dose_mg=max_single,
        max_daily_dose_mg=max_safe_daily,
        frequency_per_day_min=int(freq_min) if freq_min is not None else None,
        frequency_per_day_max=int(freq_max) if freq_max is not None else None,
        source=str(ref.get("source") or ""),
        message=" ".join(msg_parts),
    )


def validate_dosage(
    generic_name: str,
    prescribed_dose_mg: float | None,
    prescribed_frequency_per_day: int | None,
    route: str,
    child_age_months: float | None,
    child_weight_kg: float | None,
) -> DosageFinding:
    route_norm = (route or "oral").strip().lower()
    if child_weight_kg is None:
        return DosageFinding(
            generic_name=generic_name,
            status="cannot_validate",
            prescribed_dose_mg=prescribed_dose_mg,
            message="Child's weight not available. Add a growth record to enable dosage validation.",
        )

    ref = _load_dosage_reference(generic_name, route_norm, child_age_months)

    if not ref:
        return DosageFinding(
            generic_name=generic_name,
            status="cannot_validate",
            prescribed_dose_mg=prescribed_dose_mg,
            message=(
                "No pediatric dosage reference available for this drug/route/age combination. "
                "Doctor review recommended."
            ),
            age_appropriate=None if child_age_months is None or child_age_months <= 0 else False,
        )

    dose_per_kg = ref.get("dose_per_kg_mg")
    max_single = ref.get("max_single_dose_mg")
    max_daily_ref = ref.get("max_daily_dose_mg")
    freq_min = ref.get("frequency_per_day_min") or 1
    freq_max = ref.get("frequency_per_day_max") or freq_min

    expected_range, max_safe_daily, _ = _compute_expected_ranges(ref, float(child_weight_kg))

    prescribed_daily = None
    if prescribed_dose_mg is not None and prescribed_frequency_per_day:
        prescribed_daily = float(prescribed_dose_mg) * int(prescribed_frequency_per_day)

    status: DosageStatus = "within_range"
    message = f"Prescribed dose for {generic_name} appears within typical pediatric range."

    if prescribed_dose_mg is None:
        status = "cannot_validate"
        message = f"Could not parse prescribed dose for {generic_name}. Doctor review recommended."
    elif expected_range is not None:
        lo, hi = expected_range
        if float(prescribed_dose_mg) < lo:
            status = "below_range"
            message = (
                f"Prescribed: {prescribed_dose_mg}mg"
                f"{f', {prescribed_frequency_per_day}x/day' if prescribed_frequency_per_day else ''}. "
                f"Expected for {child_weight_kg}kg child: {lo:.0f}–{hi:.0f}mg per dose. "
                "Dose may be below typical range — please confirm."
            )
        elif float(prescribed_dose_mg) > hi:
            status = "above_range"
            message = (
                f"Prescribed: {prescribed_dose_mg}mg"
                f"{f', {prescribed_frequency_per_day}x/day' if prescribed_frequency_per_day else ''}. "
                f"Expected for {child_weight_kg}kg child: {lo:.0f}–{hi:.0f}mg per dose. "
                "Dose may be above typical range — please confirm."
            )
        if prescribed_daily is not None and max_safe_daily is not None and prescribed_daily > max_safe_daily:
            status = "above_range"
            message = (
                f"Prescribed daily total {prescribed_daily:.0f}mg exceeds max safe "
                f"{max_safe_daily:.0f}mg/day for {child_weight_kg}kg child."
            )

    return DosageFinding(
        generic_name=generic_name,
        status=status,
        prescribed_dose_mg=prescribed_dose_mg,
        expected_dose_range_mg=expected_range,
        prescribed_daily_total_mg=prescribed_daily,
        max_safe_daily_mg=max_safe_daily,
        age_appropriate=None if child_age_months is None or child_age_months <= 0 else True,
        message=message,
    )


def compute_overall_risk(
    interactions: list[InteractionFinding],
    dosages: list[DosageFinding],
    unrecognized: list[str],
) -> RiskLevel:
    level: RiskLevel = "none"

    def bump(current: RiskLevel, new: RiskLevel) -> RiskLevel:
        order = ["none", "low", "moderate", "high", "critical"]
        return new if order.index(new) > order.index(current) else current

    for item in interactions:
        if item.severity == "contraindicated":
            level = bump(level, "critical")
        elif item.severity == "major":
            level = bump(level, "high")
        elif item.severity == "moderate":
            level = bump(level, "moderate")
        elif item.severity == "minor":
            level = bump(level, "low")

    for dose in dosages:
        if dose.status == "above_range":
            if (
                dose.prescribed_daily_total_mg is not None
                and dose.max_safe_daily_mg is not None
                and dose.prescribed_daily_total_mg > dose.max_safe_daily_mg * 1.5
            ):
                level = bump(level, "critical")
            else:
                level = bump(level, "high")
        elif dose.status == "below_range":
            level = bump(level, "moderate")
        elif dose.status == "cannot_validate":
            level = bump(level, "low")

    if unrecognized and level == "none":
        level = "low"

    return level


def summarize_findings(
    interactions: list[InteractionFinding],
    dosages: list[DosageFinding],
    unrecognized: list[str],
) -> str:
    if not interactions and not dosages and not unrecognized:
        return "No prescription safety issues were identified from the available reference data."

    payload = {
        "interactions": [
            {
                "drug_a": i.drug_a,
                "drug_b": i.drug_b,
                "severity": i.severity,
                "clinical_effect": i.clinical_effect,
                "management": i.management,
            }
            for i in interactions
        ],
        "dosage": [
            {
                "generic_name": d.generic_name,
                "status": d.status,
                "message": d.message,
            }
            for d in dosages
            if d.status != "within_range"
        ],
        "unrecognized_drugs": unrecognized,
    }

    client = _client()
    if client is None:
        parts = []
        if interactions:
            parts.append(f"{len(interactions)} interaction(s) flagged.")
        if dosages:
            flagged = [d for d in dosages if d.status != "within_range"]
            if flagged:
                parts.append(f"{len(flagged)} dosage concern(s).")
        if unrecognized:
            parts.append(f"Unrecognized: {', '.join(unrecognized)}.")
        return " ".join(parts) if parts else "No issues found."

    system = (
        "You summarize pre-computed clinical safety findings for a doctor. "
        "Write a brief plain-language summary (max 150 words). "
        "Do NOT add any new clinical claims, drug interactions, or dosage information beyond what is provided. "
        "Recognized vaccines (e.g. Hepatitis B, Influenza) are immunization products — do not describe them as "
        "unrecognized or requiring efficacy investigation when they are absent from unrecognized_drugs. "
        "If the findings list is empty, state no issues were found."
    )
    try:
        response = client.chat.completions.create(
            model=SUMMARY_MODEL,
            temperature=0.2,
            max_tokens=220,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload)},
            ],
        )
        return (response.choices[0].message.content or "").strip()
    except Exception:
        LOG.warning("prescription_validation_summary_failed", exc_info=True)
        return "Safety findings are available for review. Automated summary could not be generated."


def run_prescription_validation(
    medications: list[dict[str, Any]],
    active_drugs: list[str],
    child_age_months: float | None,
    child_weight_kg: float | None,
    weight_source: str,
    active_drug_names: list[str] | None = None,
) -> ValidationResult:
    catalog = _load_drug_catalog()
    unrecognized: list[str] = []
    normalized_names: list[str] = []
    norm_by_index: list[NormalizationResult] = []

    for med in medications:
        name = str(med.get("name") or med.get("Name") or "").strip()
        if not name:
            continue
        norm = normalize_drug_name(name, catalog)
        norm_by_index.append(norm)
        if norm.generic_name:
            normalized_names.append(norm.generic_name)
        else:
            unrecognized.append(name)

    active_generics = list(active_drugs or [])
    for raw in active_drug_names or []:
        norm = normalize_drug_name(str(raw), catalog)
        if norm.generic_name and norm.generic_name not in normalized_names:
            active_generics.append(norm.generic_name)
    active_generics = sorted({g for g in active_generics if g})

    interactions = check_drug_interactions(normalized_names, active_generics)

    dosage_findings: list[DosageFinding] = []
    age_months = float(child_age_months) if child_age_months is not None else None
    for med, norm in zip(medications, norm_by_index):
        if not norm.generic_name:
            continue
        if _skip_weight_based_dosage_validation(catalog, norm.generic_name):
            continue
        freq = med.get("frequency_per_day") or med.get("FrequencyPerDay")
        route = str(med.get("route") or med.get("Route") or "oral")
        dose_val = _resolve_prescribed_dose_mg(med)
        try:
            freq_val = int(freq) if freq is not None else None
        except (TypeError, ValueError):
            freq_val = None
        dosage_findings.append(
            validate_dosage(
                norm.generic_name,
                dose_val,
                freq_val,
                route,
                age_months,
                float(child_weight_kg) if child_weight_kg is not None else None,
            )
        )

    risk = compute_overall_risk(interactions, dosage_findings, unrecognized)
    summary = summarize_findings(interactions, dosage_findings, unrecognized)

    return ValidationResult(
        overall_risk_level=risk,
        interaction_findings=interactions,
        dosage_findings=dosage_findings,
        unrecognized_drugs=unrecognized,
        weight_source=weight_source or "not_available",
        llm_summary=summary,
    )


def _resolve_prescribed_dose_mg(med: dict[str, Any]) -> float | None:
    dose_mg = med.get("dose_mg") or med.get("DoseMg")
    if dose_mg is not None:
        try:
            return float(dose_mg)
        except (TypeError, ValueError):
            pass
    name = str(med.get("name") or med.get("Name") or "").strip()
    dosage_hint = str(med.get("dosage") or med.get("Dosage") or "").strip()
    return _parse_syrup_or_explicit_dose_mg(name, dosage_hint)


_SYRUP_FORM = re.compile(r"\b(?:syp\.?|syr\.?|syrup|susp\.?|suspension)\b", re.IGNORECASE)
_TRAILING_STRENGTH = re.compile(r"(\d{2,4})\s*(?:mg\s*/\s*5\s*ml)?\s*$", re.IGNORECASE)


def _parse_syrup_or_explicit_dose_mg(product_name: str, dosage_text: str) -> float | None:
    combined = f"{product_name} {dosage_text}".strip()
    if not combined:
        return None
    explicit = parse_dose_mg_from_text(combined)
    if explicit is not None and re.search(r"\d+(?:\.\d+)?\s*mg", combined.lower()):
        return explicit
    ml_match = re.search(r"(\d+(?:\.\d+)?)\s*ml\b", combined.lower())
    if ml_match and _SYRUP_FORM.search(product_name):
        strength_match = _TRAILING_STRENGTH.search(product_name.strip())
        if strength_match:
            ml = float(ml_match.group(1))
            strength = float(strength_match.group(1))
            return ml * (strength / 5.0)
    if product_name and not _SYRUP_FORM.search(product_name):
        tablet_strength = _TRAILING_STRENGTH.search(product_name.strip())
        if tablet_strength:
            return float(tablet_strength.group(1))
    return None


def parse_dose_mg_from_text(text: str) -> float | None:
    if not text:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)\s*mg", text.lower())
    if match:
        return float(match.group(1))
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if match:
        return float(match.group(1))
    return None


def parse_frequency_per_day(text: str) -> int | None:
    if not text:
        return None
    lower = text.lower()
    mapping = {
        "od": 1,
        "once": 1,
        "bd": 2,
        "bid": 2,
        "twice": 2,
        "tds": 3,
        "tid": 3,
        "thrice": 3,
        "qid": 4,
        "q.i.d": 4,
        "four": 4,
    }
    for key, val in mapping.items():
        if key in lower:
            return val
    match = re.search(r"(\d+)\s*(?:x|times?)\s*(?:per\s*)?day", lower)
    if match:
        return int(match.group(1))
    return None
