from __future__ import annotations

from typing import Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class QueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(
        min_length=2,
        max_length=4000,
        validation_alias=AliasChoices("Question", "question"),
        serialization_alias="Question",
    )
    conversation_id: Optional[str] = Field(
        default="default",
        validation_alias=AliasChoices("ConversationId", "conversation_id"),
        serialization_alias="ConversationId",
    )
    history: list["ChatHistoryItem"] = Field(
        default_factory=list,
        validation_alias=AliasChoices("History", "history"),
        serialization_alias="History",
    )
    user_id: Optional[str] = Field(
        default="",
        validation_alias=AliasChoices("UserId", "user_id"),
        serialization_alias="UserId",
    )


class ChatHistoryItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: str = Field(
        default="user",
        validation_alias=AliasChoices("Role", "role"),
        serialization_alias="Role",
    )
    content: str = Field(
        default="",
        validation_alias=AliasChoices("Content", "content"),
        serialization_alias="Content",
    )


class QueryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    answer: str = Field(validation_alias=AliasChoices("Answer", "answer"), serialization_alias="Answer")
    source: str = Field(validation_alias=AliasChoices("Source", "source"), serialization_alias="Source")
    chunks_used: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("ChunksUsed", "chunks_used"),
        serialization_alias="ChunksUsed",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("FollowUpQuestions", "follow_up_questions"),
        serialization_alias="FollowUpQuestions",
    )


class IngestResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(validation_alias=AliasChoices("Status", "status"), serialization_alias="Status")
    triggered_by: str = Field(
        validation_alias=AliasChoices("TriggeredBy", "triggered_by"),
        serialization_alias="TriggeredBy",
    )


class IngestFailureItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_hash: str = Field(validation_alias=AliasChoices("FileHash", "file_hash"), serialization_alias="FileHash")
    filename: str = Field(validation_alias=AliasChoices("Filename", "filename"), serialization_alias="Filename")
    filepath: str = Field(validation_alias=AliasChoices("Filepath", "filepath"), serialization_alias="Filepath")
    error: str = Field(validation_alias=AliasChoices("Error", "error"), serialization_alias="Error")


class PreFilterStatsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_pages: int = Field(validation_alias=AliasChoices("TotalPages", "total_pages"), serialization_alias="TotalPages")
    classify_pages: int = Field(
        validation_alias=AliasChoices("ClassifyPages", "classify_pages"),
        serialization_alias="ClassifyPages",
    )
    clean_pages: int = Field(validation_alias=AliasChoices("CleanPages", "clean_pages"), serialization_alias="CleanPages")
    dedup_pages: int = Field(validation_alias=AliasChoices("DedupPages", "dedup_pages"), serialization_alias="DedupPages")
    dropped_percent: int = Field(
        validation_alias=AliasChoices("DroppedPercent", "dropped_percent"),
        serialization_alias="DroppedPercent",
    )
    fallback_used: bool = Field(
        validation_alias=AliasChoices("FallbackUsed", "fallback_used"),
        serialization_alias="FallbackUsed",
    )


class IngestFileItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_hash: str = Field(validation_alias=AliasChoices("FileHash", "file_hash"), serialization_alias="FileHash")
    filename: str = Field(validation_alias=AliasChoices("Filename", "filename"), serialization_alias="Filename")
    filepath: str = Field(validation_alias=AliasChoices("Filepath", "filepath"), serialization_alias="Filepath")
    status: str = Field(validation_alias=AliasChoices("Status", "status"), serialization_alias="Status")
    chunks_count: int = Field(validation_alias=AliasChoices("ChunksCount", "chunks_count"), serialization_alias="ChunksCount")
    error: str = Field(validation_alias=AliasChoices("Error", "error"), serialization_alias="Error")
    prefilter_stats: Optional[PreFilterStatsResponse] = Field(
        default=None,
        validation_alias=AliasChoices("PreFilterStats", "prefilter_stats"),
        serialization_alias="PreFilterStats",
    )


class IngestStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_registry_records: int = Field(
        validation_alias=AliasChoices("TotalRegistryRecords", "total_registry_records"),
        serialization_alias="TotalRegistryRecords",
    )
    processed: int = Field(validation_alias=AliasChoices("Processed", "processed"), serialization_alias="Processed")
    processing: int = Field(validation_alias=AliasChoices("Processing", "processing"), serialization_alias="Processing")
    failed: int = Field(validation_alias=AliasChoices("Failed", "failed"), serialization_alias="Failed")
    pending_files: int = Field(
        validation_alias=AliasChoices("PendingFiles", "pending_files"),
        serialization_alias="PendingFiles",
    )
    recent_failures: list[IngestFailureItem] = Field(
        validation_alias=AliasChoices("RecentFailures", "recent_failures"),
        serialization_alias="RecentFailures",
    )
    recent_files: list[IngestFileItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("RecentFiles", "recent_files"),
        serialization_alias="RecentFiles",
    )


class IngestHealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_registry_records: int = Field(
        validation_alias=AliasChoices("TotalRegistryRecords", "total_registry_records"),
        serialization_alias="TotalRegistryRecords",
    )
    processed: int = Field(validation_alias=AliasChoices("Processed", "processed"), serialization_alias="Processed")
    processing: int = Field(validation_alias=AliasChoices("Processing", "processing"), serialization_alias="Processing")
    failed: int = Field(validation_alias=AliasChoices("Failed", "failed"), serialization_alias="Failed")
    pending_files: int = Field(
        validation_alias=AliasChoices("PendingFiles", "pending_files"),
        serialization_alias="PendingFiles",
    )
