from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=4000)


class QueryResponse(BaseModel):
    answer: str
    source: str
    chunks_used: Optional[int] = None


class IngestResponse(BaseModel):
    status: str
    triggered_by: str
