import asyncio
import json
import logging
import time
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from auth.dependencies import get_current_user
from auth.models import TokenPayload
from query.triage_pipeline import analyze_triage, run_analyze_triage_stream, sanitize_symptoms

router = APIRouter()
LOG = logging.getLogger(__name__)


class TriageAnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    child_age_months: int = Field(
        ...,
        ge=0,
        le=216,
        validation_alias=AliasChoices("ChildAgeMonths", "child_age_months"),
        serialization_alias="ChildAgeMonths",
    )
    child_weight_kg: float | None = Field(
        default=None,
        validation_alias=AliasChoices("ChildWeightKg", "child_weight_kg"),
        serialization_alias="ChildWeightKg",
    )
    reported_symptoms: list[str] = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("ReportedSymptoms", "reported_symptoms"),
        serialization_alias="ReportedSymptoms",
    )
    symptom_duration_hours: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("SymptomDurationHours", "symptom_duration_hours"),
        serialization_alias="SymptomDurationHours",
    )
    symptom_severity: str = Field(
        ...,
        validation_alias=AliasChoices("SymptomSeverity", "symptom_severity"),
        serialization_alias="SymptomSeverity",
    )
    additional_notes: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AdditionalNotes", "additional_notes"),
        serialization_alias="AdditionalNotes",
    )

    @field_validator("reported_symptoms", mode="before")
    @classmethod
    def _sanitize_symptoms(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        return sanitize_symptoms([str(v) for v in value])

    @field_validator("symptom_severity", mode="before")
    @classmethod
    def _normalize_severity(cls, value: object) -> str:
        return str(value or "").strip().upper()


class TriageAnalyzeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    urgency_level: str = Field(
        serialization_alias="UrgencyLevel",
        validation_alias=AliasChoices("UrgencyLevel", "urgency_level"),
    )
    urgency_reasoning: str = Field(
        serialization_alias="UrgencyReasoning",
        validation_alias=AliasChoices("UrgencyReasoning", "urgency_reasoning"),
    )
    doctor_note: str = Field(
        serialization_alias="DoctorNote",
        validation_alias=AliasChoices("DoctorNote", "doctor_note"),
    )
    red_flags: list[str] = Field(
        default_factory=list,
        serialization_alias="RedFlags",
        validation_alias=AliasChoices("RedFlags", "red_flags"),
    )
    confidence: str = Field(
        serialization_alias="Confidence",
        validation_alias=AliasChoices("Confidence", "confidence"),
    )
    rag_chunks_used: list[dict] = Field(
        default_factory=list,
        serialization_alias="RagChunksUsed",
        validation_alias=AliasChoices("RagChunksUsed", "rag_chunks_used"),
    )
    model_used: str = Field(
        serialization_alias="ModelUsed",
        validation_alias=AliasChoices("ModelUsed", "model_used"),
    )


@router.post("/triage/analyze", response_model=TriageAnalyzeResponse, response_model_by_alias=True)
async def triage_analyze(body: TriageAnalyzeRequest, user: TokenPayload = Depends(get_current_user)):
    _ = user
    started = time.perf_counter()
    LOG.info("[TRIAGE][API] analyze_start age_months=%s symptom_count=%s", body.child_age_months, len(body.reported_symptoms))
    try:
        result = analyze_triage(
            child_age_months=body.child_age_months,
            child_weight_kg=body.child_weight_kg,
            reported_symptoms=body.reported_symptoms,
            symptom_duration_hours=body.symptom_duration_hours,
            symptom_severity=body.symptom_severity,
            additional_notes=body.additional_notes,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "TRIAGE_SYMPTOMS_REQUIRED":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=code) from exc
        if code == "TRIAGE_SEVERITY_INVALID":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=code) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code) from exc
    except Exception as exc:
        LOG.exception("[TRIAGE] analyze_failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TRIAGE_ANALYSIS_UNAVAILABLE",
        ) from exc

    LOG.info(
        "[TRIAGE][API] analyze_complete total_ms=%.0f urgency=%s",
        (time.perf_counter() - started) * 1000,
        result.get("UrgencyLevel"),
    )
    return TriageAnalyzeResponse.model_validate(result)


def _ndjson_line(obj: dict) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


@router.post("/triage/analyze/stream")
async def triage_analyze_stream(body: TriageAnalyzeRequest, user: TokenPayload = Depends(get_current_user)):
    """NDJSON stream: ``ready``, ``status``, ``delta``, ``complete`` (triage result)."""
    _ = user
    started = time.perf_counter()
    LOG.info("[TRIAGE][API] stream_start age_months=%s symptom_count=%s", body.child_age_months, len(body.reported_symptoms))
    queue: asyncio.Queue = asyncio.Queue()

    async def runner() -> None:
        try:
            await run_analyze_triage_stream(
                child_age_months=body.child_age_months,
                child_weight_kg=body.child_weight_kg,
                reported_symptoms=body.reported_symptoms,
                symptom_duration_hours=body.symptom_duration_hours,
                symptom_severity=body.symptom_severity,
                additional_notes=body.additional_notes,
                stream_queue=queue,
            )
        except Exception as exc:
            LOG.exception("[TRIAGE][STREAM] runner failed")
            await queue.put(("error", {"message": str(exc)}))
        finally:
            await queue.put(None)

    task = asyncio.create_task(runner())

    async def gen() -> AsyncIterator[bytes]:
        yield _ndjson_line({"type": "ready", "data": {"source": "triage", "phase": "accepted"}})
        LOG.info("[TRIAGE][API][TIMING] stream_ready_ms=%.0f", (time.perf_counter() - started) * 1000)
        ping_interval_s = 2.0
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=ping_interval_s)
                except asyncio.TimeoutError:
                    yield _ndjson_line({"type": "ping", "data": {"phase": "processing"}})
                    continue
                if item is None:
                    break
                kind, payload = item
                if kind == "ready":
                    obj = {"type": "ready", "data": payload}
                elif kind == "delta":
                    obj = {"type": "delta", "text": payload}
                elif kind == "status":
                    obj = {"type": "status", "data": payload}
                elif kind == "complete":
                    try:
                        resp = TriageAnalyzeResponse.model_validate(payload)
                        obj = {"type": "complete", "data": resp.model_dump(by_alias=True)}
                        LOG.info(
                            "[TRIAGE][API][TIMING] stream_complete_ms=%.0f urgency=%s",
                            (time.perf_counter() - started) * 1000,
                            resp.urgency_level,
                        )
                    except Exception as exc:
                        LOG.warning("[TRIAGE][STREAM] complete validate failed: %s", exc)
                        obj = {"type": "error", "data": {"message": "invalid_triage_response"}}
                elif kind == "error":
                    obj = {"type": "error", "data": payload}
                else:
                    continue
                yield _ndjson_line(obj)
        finally:
            await task

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
