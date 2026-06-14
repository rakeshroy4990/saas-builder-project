"""Prescription safety validation API."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from auth.dependencies import get_current_user
from auth.models import TokenPayload
from prescription.validation_pipeline import recommend_pediatric_dosage, run_prescription_validation

router = APIRouter()
LOG = logging.getLogger(__name__)


class MedicationInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(validation_alias=AliasChoices("Name", "name"))
    dose_mg: float | None = Field(
        default=None,
        validation_alias=AliasChoices("DoseMg", "dose_mg"),
        serialization_alias="DoseMg",
    )
    frequency_per_day: int | None = Field(
        default=None,
        validation_alias=AliasChoices("FrequencyPerDay", "frequency_per_day"),
        serialization_alias="FrequencyPerDay",
    )
    route: str = Field(
        default="oral",
        validation_alias=AliasChoices("Route", "route"),
        serialization_alias="Route",
    )


class PrescriptionValidateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    medications: list[MedicationInput] = Field(
        validation_alias=AliasChoices("Medications", "medications"),
        serialization_alias="Medications",
    )
    active_drugs: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("ActiveDrugs", "active_drugs"),
        serialization_alias="ActiveDrugs",
    )
    active_drug_names: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("ActiveDrugNames", "active_drug_names"),
        serialization_alias="ActiveDrugNames",
    )
    child_age_months: float | None = Field(
        default=None,
        validation_alias=AliasChoices("ChildAgeMonths", "child_age_months"),
        serialization_alias="ChildAgeMonths",
    )
    child_weight_kg: float | None = Field(
        default=None,
        validation_alias=AliasChoices("ChildWeightKg", "child_weight_kg"),
        serialization_alias="ChildWeightKg",
    )
    weight_source: str = Field(
        default="not_available",
        validation_alias=AliasChoices("WeightSource", "weight_source"),
        serialization_alias="WeightSource",
    )


def _serialize_result(result) -> dict[str, Any]:
    return {
        "OverallRiskLevel": result.overall_risk_level,
        "WeightSource": result.weight_source,
        "LlmSummary": result.llm_summary,
        "UnrecognizedDrugs": result.unrecognized_drugs,
        "InteractionFindings": [
            {
                "DrugA": f.drug_a,
                "DrugB": f.drug_b,
                "Severity": f.severity,
                "Mechanism": f.mechanism,
                "ClinicalEffect": f.clinical_effect,
                "Management": f.management,
                "Source": f.source,
                "DrugsFrom": f.drugs_from,
            }
            for f in result.interaction_findings
        ],
        "DosageFindings": [
            {
                "GenericName": d.generic_name,
                "Status": d.status,
                "PrescribedDoseMg": d.prescribed_dose_mg,
                "ExpectedDoseRangeMg": list(d.expected_dose_range_mg)
                if d.expected_dose_range_mg
                else None,
                "PrescribedDailyTotalMg": d.prescribed_daily_total_mg,
                "MaxSafeDailyMg": d.max_safe_daily_mg,
                "AgeAppropriate": d.age_appropriate,
                "Message": d.message,
            }
            for d in result.dosage_findings
        ],
    }


@router.post("/prescriptions/validate")
async def validate_prescription(
    body: PrescriptionValidateRequest,
    _user: TokenPayload = Depends(get_current_user),
):
    if not body.medications:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one medication is required.",
        )
    meds = [m.model_dump(by_alias=False) for m in body.medications]
    try:
        result = run_prescription_validation(
            medications=meds,
            active_drugs=body.active_drugs,
            active_drug_names=body.active_drug_names,
            child_age_months=body.child_age_months,
            child_weight_kg=body.child_weight_kg,
            weight_source=body.weight_source,
        )
    except Exception as exc:
        LOG.exception("prescription_validation_failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prescription validation service unavailable.",
        ) from exc
    return _serialize_result(result)


class RecommendedDosageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    drug_name: str = Field(validation_alias=AliasChoices("DrugName", "drug_name"), serialization_alias="DrugName")
    child_age_months: float = Field(
        validation_alias=AliasChoices("ChildAgeMonths", "child_age_months"),
        serialization_alias="ChildAgeMonths",
    )
    child_weight_kg: float | None = Field(
        default=None,
        validation_alias=AliasChoices("ChildWeightKg", "child_weight_kg"),
        serialization_alias="ChildWeightKg",
    )
    route: str = Field(
        default="oral",
        validation_alias=AliasChoices("Route", "route"),
        serialization_alias="Route",
    )


def _serialize_recommended(result) -> dict[str, Any]:
    return {
        "ExtractedName": result.extracted_name,
        "GenericName": result.generic_name,
        "Status": result.status,
        "ChildWeightKg": result.child_weight_kg,
        "ChildAgeMonths": result.child_age_months,
        "Route": result.route,
        "DosePerKgMg": result.dose_per_kg_mg,
        "ExpectedDoseRangeMg": list(result.expected_dose_range_mg)
        if result.expected_dose_range_mg
        else None,
        "MaxSingleDoseMg": result.max_single_dose_mg,
        "MaxDailyDoseMg": result.max_daily_dose_mg,
        "FrequencyPerDayMin": result.frequency_per_day_min,
        "FrequencyPerDayMax": result.frequency_per_day_max,
        "Source": result.source,
        "Message": result.message,
    }


@router.post("/prescriptions/recommended-dosage")
async def recommended_dosage(
    body: RecommendedDosageRequest,
    _user: TokenPayload = Depends(get_current_user),
):
    if not body.drug_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="DrugName is required.")
    try:
        result = recommend_pediatric_dosage(
            body.drug_name.strip(),
            body.child_age_months,
            body.child_weight_kg,
            body.route,
        )
    except Exception as exc:
        LOG.exception("recommended_dosage_failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommended dosage service unavailable.",
        ) from exc
    return _serialize_recommended(result)
