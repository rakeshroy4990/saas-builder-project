import asyncio
import json
import logging
import time
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from auth.dependencies import get_current_user
from auth.models import TokenPayload
from query.growth_summary_pipeline import run_growth_history_summary_stream, summarize_growth_history

router = APIRouter()
LOG = logging.getLogger(__name__)


class GrowthHistorySummaryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    age_months_at_recording: float = Field(
        ...,
        ge=0,
        le=216,
        validation_alias=AliasChoices("AgeMonthsAtRecording", "age_months_at_recording"),
        serialization_alias="AgeMonthsAtRecording",
    )
    weight_kg: float | None = Field(
        default=None,
        validation_alias=AliasChoices("WeightKg", "weight_kg"),
        serialization_alias="WeightKg",
    )
    height_cm: float | None = Field(
        default=None,
        validation_alias=AliasChoices("HeightCm", "height_cm"),
        serialization_alias="HeightCm",
    )
    head_circumference_cm: float | None = Field(
        default=None,
        validation_alias=AliasChoices("HeadCircumferenceCm", "head_circumference_cm"),
        serialization_alias="HeadCircumferenceCm",
    )
    weight_percentile: float | None = Field(
        default=None,
        validation_alias=AliasChoices("WeightPercentile", "weight_percentile"),
        serialization_alias="WeightPercentile",
    )
    height_percentile: float | None = Field(
        default=None,
        validation_alias=AliasChoices("HeightPercentile", "height_percentile"),
        serialization_alias="HeightPercentile",
    )
    bmi_percentile: float | None = Field(
        default=None,
        validation_alias=AliasChoices("BmiPercentile", "bmi_percentile"),
        serialization_alias="BmiPercentile",
    )
    hc_percentile: float | None = Field(
        default=None,
        validation_alias=AliasChoices("HcPercentile", "hc_percentile"),
        serialization_alias="HcPercentile",
    )
    reply_locale: str | None = Field(
        default=None,
        validation_alias=AliasChoices("ReplyLocale", "reply_locale"),
        serialization_alias="ReplyLocale",
    )
    sex: str | None = Field(
        default=None,
        validation_alias=AliasChoices("Sex", "sex"),
        serialization_alias="Sex",
    )


class GrowthCharacteristicsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    phrase: str = Field(
        default="",
        serialization_alias="Phrase",
        validation_alias=AliasChoices("Phrase", "phrase"),
    )
    labels: list[str] = Field(
        default_factory=list,
        serialization_alias="Labels",
        validation_alias=AliasChoices("Labels", "labels"),
    )
    trait_codes: list[str] = Field(
        default_factory=list,
        serialization_alias="TraitCodes",
        validation_alias=AliasChoices("TraitCodes", "trait_codes"),
    )


class GrowthHistorySummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    summary: str = Field(
        serialization_alias="Summary",
        validation_alias=AliasChoices("Summary", "summary"),
    )
    model_used: str = Field(
        default="",
        serialization_alias="ModelUsed",
        validation_alias=AliasChoices("ModelUsed", "model_used"),
    )
    reply_locale: str = Field(
        default="en",
        serialization_alias="ReplyLocale",
        validation_alias=AliasChoices("ReplyLocale", "reply_locale"),
    )
    characteristics: GrowthCharacteristicsResponse | None = Field(
        default=None,
        serialization_alias="Characteristics",
        validation_alias=AliasChoices("Characteristics", "characteristics"),
    )


@router.post(
    "/growth/history/summarize",
    response_model=GrowthHistorySummaryResponse,
    response_model_by_alias=True,
)
async def growth_history_summarize(body: GrowthHistorySummaryRequest, user: TokenPayload = Depends(get_current_user)):
    _ = user
    started = time.perf_counter()
    LOG.info("[GROWTH][API] summarize_start age_months=%s", body.age_months_at_recording)
    try:
        result = summarize_growth_history(
            age_months=int(body.age_months_at_recording),
            weight_kg=body.weight_kg,
            height_cm=body.height_cm,
            head_circumference_cm=body.head_circumference_cm,
            weight_percentile=body.weight_percentile,
            height_percentile=body.height_percentile,
            bmi_percentile=body.bmi_percentile,
            hc_percentile=body.hc_percentile,
            reply_locale=body.reply_locale,
            sex=body.sex,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "GROWTH_SUMMARY_MEASUREMENT_REQUIRED":
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=code) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code) from exc
    except Exception as exc:
        LOG.exception("[GROWTH][API] summarize_failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GROWTH_SUMMARY_UNAVAILABLE",
        ) from exc

    LOG.info(
        "[GROWTH][API] summarize_complete total_ms=%.0f summary_len=%s",
        (time.perf_counter() - started) * 1000,
        len(result.get("Summary") or ""),
    )
    return GrowthHistorySummaryResponse.model_validate(result)


def _ndjson_line(obj: dict) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


@router.post("/growth/history/summarize/stream")
async def growth_history_summarize_stream(body: GrowthHistorySummaryRequest, user: TokenPayload = Depends(get_current_user)):
    """NDJSON stream: ``ready``, ``status``, ``delta``, ``complete`` (summary)."""
    _ = user
    started = time.perf_counter()
    LOG.info("[GROWTH][API] stream_start age_months=%s", body.age_months_at_recording)
    queue: asyncio.Queue = asyncio.Queue()

    async def runner() -> None:
        try:
            await run_growth_history_summary_stream(
                age_months=int(body.age_months_at_recording),
                weight_kg=body.weight_kg,
                height_cm=body.height_cm,
                head_circumference_cm=body.head_circumference_cm,
                weight_percentile=body.weight_percentile,
                height_percentile=body.height_percentile,
                bmi_percentile=body.bmi_percentile,
                hc_percentile=body.hc_percentile,
                reply_locale=body.reply_locale,
                sex=body.sex,
                stream_queue=queue,
            )
        except Exception as exc:
            LOG.exception("[GROWTH][STREAM] runner failed")
            await queue.put(("error", {"message": str(exc)}))
        finally:
            await queue.put(None)

    task = asyncio.create_task(runner())

    async def gen() -> AsyncIterator[bytes]:
        yield _ndjson_line({"type": "ready", "data": {"source": "growth", "phase": "accepted"}})
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
                if kind == "delta":
                    obj = {"type": "delta", "text": payload}
                elif kind == "status":
                    obj = {"type": "status", "data": payload}
                elif kind == "complete":
                    try:
                        resp = GrowthHistorySummaryResponse.model_validate(payload)
                        obj = {"type": "complete", "data": resp.model_dump(by_alias=True)}
                        LOG.info(
                            "[GROWTH][API] stream_complete total_ms=%.0f summary_len=%s",
                            (time.perf_counter() - started) * 1000,
                            len(resp.summary or ""),
                        )
                    except Exception as exc:
                        LOG.warning("[GROWTH][STREAM] complete validate failed: %s", exc)
                        obj = {"type": "error", "data": {"message": "invalid_growth_summary_response"}}
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
