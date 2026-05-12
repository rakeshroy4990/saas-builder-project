from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class QueryResponseImageItem(BaseModel):
    """Figure reference returned alongside ``QueryResponse.Answer`` (S3 URL + caption)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    img_index: int = Field(
        default=0,
        validation_alias=AliasChoices("ImgIndex", "img_index"),
        serialization_alias="ImgIndex",
    )
    page: int = Field(
        default=0,
        validation_alias=AliasChoices("Page", "page"),
        serialization_alias="Page",
    )
    ext: str = Field(
        default="png",
        validation_alias=AliasChoices("Ext", "ext"),
        serialization_alias="Ext",
    )
    caption: str = Field(
        default="",
        validation_alias=AliasChoices("Caption", "caption"),
        serialization_alias="Caption",
    )
    image_data: str = Field(
        default="",
        validation_alias=AliasChoices("ImageData", "image_data"),
        serialization_alias="ImageData",
    )
    url: str = Field(
        default="",
        validation_alias=AliasChoices("Url", "url"),
        serialization_alias="Url",
    )
    source_file: str = Field(
        default="",
        validation_alias=AliasChoices("SourceFile", "source_file"),
        serialization_alias="SourceFile",
    )


class MarkerIngestRequest(BaseModel):
    """Body for ``POST /api/v1/ingest/marker`` (PDF under ``PDF_DIR``)."""

    model_config = ConfigDict(populate_by_name=True)

    pdf_name: str = Field(
        ...,
        min_length=1,
        max_length=512,
        validation_alias=AliasChoices("PdfName", "pdf_name"),
        serialization_alias="PdfName",
        description="Filename or stem of a PDF in PDF_DIR (e.g. IAP STG-2022 Updated.pdf)",
    )
    book_name: str = Field(
        ...,
        min_length=1,
        max_length=512,
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
        description="Logical book label stored on the PDF registry; used to scope queries.",
    )
    book_status: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("Status", "BookStatus", "book_status"),
        serialization_alias="BookStatus",
        description='Optional lifecycle flag. Omit or "Active" = retrievable; "OutDated" excludes from default queries.',
    )

    @field_validator("book_name", mode="before")
    @classmethod
    def _strip_book_name(cls, v: object) -> object:
        if v is None:
            return v
        return str(v).strip()

    @field_validator("book_status", mode="before")
    @classmethod
    def _normalize_book_status(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        low = s.lower()
        if low == "outdated":
            return "OutDated"
        if low == "active":
            return None
        raise ValueError('book status must be omitted, "Active", or "OutDated"')
    pages_csv: Optional[str] = Field(
        default=None,
        max_length=2048,
        validation_alias=AliasChoices("PagesCsv", "pages_csv"),
        serialization_alias="PagesCsv",
        description="Optional 1-based page ranges, e.g. '6-30' or '1,5-8'",
    )
    pages: Optional[list[int]] = Field(
        default=None,
        validation_alias=AliasChoices("Pages", "pages"),
        serialization_alias="Pages",
        description="Optional explicit 1-based page numbers (in addition to PagesCsv)",
    )


class MarkerIngestResponse(BaseModel):
    """Response for ``POST /api/v1/ingest/marker``."""

    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(
        validation_alias=AliasChoices("Status", "status"),
        serialization_alias="Status",
    )
    triggered_by: str = Field(
        validation_alias=AliasChoices("TriggeredBy", "triggered_by"),
        serialization_alias="TriggeredBy",
    )
    job_id: int = Field(validation_alias=AliasChoices("JobId", "job_id"), serialization_alias="JobId")
    file_hash: str = Field(validation_alias=AliasChoices("FileHash", "file_hash"), serialization_alias="FileHash")
    total_pages: int = Field(
        validation_alias=AliasChoices("TotalPages", "total_pages"),
        serialization_alias="TotalPages",
    )
    batch_count: int = Field(
        validation_alias=AliasChoices("BatchCount", "batch_count"),
        serialization_alias="BatchCount",
    )
    batch_size: int = Field(
        validation_alias=AliasChoices("BatchSize", "batch_size"),
        serialization_alias="BatchSize",
    )
    filepath: str = Field(validation_alias=AliasChoices("Filepath", "filepath"), serialization_alias="Filepath")
    filename: str = Field(validation_alias=AliasChoices("Filename", "filename"), serialization_alias="Filename")
    pages_queued_one_based: list[int] = Field(
        validation_alias=AliasChoices("PagesQueuedOneBased", "pages_queued_one_based"),
        serialization_alias="PagesQueuedOneBased",
    )
    pages_skipped_as_already_ingested_one_based: list[int] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "PagesSkippedAsAlreadyIngestedOneBased",
            "pages_skipped_as_already_ingested_one_based",
        ),
        serialization_alias="PagesSkippedAsAlreadyIngestedOneBased",
    )
    pages_explicitly_requested_one_based: list[int] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "PagesExplicitlyRequestedOneBased",
            "pages_explicitly_requested_one_based",
        ),
        serialization_alias="PagesExplicitlyRequestedOneBased",
    )


class MarkerDeleteBookRequest(BaseModel):
    """Body for deleting all Marker ingest artifacts for one logical book label."""

    model_config = ConfigDict(populate_by_name=True)

    book_name: str = Field(
        ...,
        min_length=1,
        max_length=512,
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
        description="Logical book label previously used during Marker ingest.",
    )

    @field_validator("book_name", mode="before")
    @classmethod
    def _strip_delete_book_name(cls, v: object) -> object:
        if v is None:
            return v
        return str(v).strip()


class MarkerDeleteBookResponse(BaseModel):
    """Response for deleting all Marker ingest artifacts for one logical book label."""

    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(
        validation_alias=AliasChoices("Status", "status"),
        serialization_alias="Status",
    )
    triggered_by: str = Field(
        validation_alias=AliasChoices("TriggeredBy", "triggered_by"),
        serialization_alias="TriggeredBy",
    )
    book_name: str = Field(
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
    )
    files_matched: int = Field(
        validation_alias=AliasChoices("FilesMatched", "files_matched"),
        serialization_alias="FilesMatched",
    )
    file_hashes: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("FileHashes", "file_hashes"),
        serialization_alias="FileHashes",
    )
    rag_chunks_deleted: int = Field(
        validation_alias=AliasChoices("RagChunksDeleted", "rag_chunks_deleted"),
        serialization_alias="RagChunksDeleted",
    )
    retrieval_items_deleted: int = Field(
        validation_alias=AliasChoices("RetrievalItemsDeleted", "retrieval_items_deleted"),
        serialization_alias="RetrievalItemsDeleted",
    )
    marker_jobs_deleted: int = Field(
        validation_alias=AliasChoices("MarkerJobsDeleted", "marker_jobs_deleted"),
        serialization_alias="MarkerJobsDeleted",
    )
    marker_batches_deleted: int = Field(
        validation_alias=AliasChoices("MarkerBatchesDeleted", "marker_batches_deleted"),
        serialization_alias="MarkerBatchesDeleted",
    )
    registry_rows_deleted: int = Field(
        validation_alias=AliasChoices("RegistryRowsDeleted", "registry_rows_deleted"),
        serialization_alias="RegistryRowsDeleted",
    )
    image_objects_deleted: int = Field(
        validation_alias=AliasChoices("ImageObjectsDeleted", "image_objects_deleted"),
        serialization_alias="ImageObjectsDeleted",
    )


class MarkerBookInfoRequest(BaseModel):
    """Body for fetching all known Marker ingest details for one logical book label."""

    model_config = ConfigDict(populate_by_name=True)

    book_name: str = Field(
        ...,
        min_length=1,
        max_length=512,
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
        description="Logical book label previously used during Marker ingest.",
    )

    @field_validator("book_name", mode="before")
    @classmethod
    def _strip_book_info_book_name(cls, v: object) -> object:
        if v is None:
            return v
        return str(v).strip()


class MarkerBookRegistryRow(BaseModel):
    """Registry row snapshot for one file belonging to a logical book."""

    model_config = ConfigDict(populate_by_name=True)

    file_hash: str = Field(validation_alias=AliasChoices("FileHash", "file_hash"), serialization_alias="FileHash")
    filename: str = Field(validation_alias=AliasChoices("Filename", "filename"), serialization_alias="Filename")
    filepath: str = Field(validation_alias=AliasChoices("Filepath", "filepath"), serialization_alias="Filepath")
    status: str = Field(validation_alias=AliasChoices("Status", "status"), serialization_alias="Status")
    book_status: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("BookStatus", "book_status"),
        serialization_alias="BookStatus",
    )
    chunks_count: int = Field(
        validation_alias=AliasChoices("ChunksCount", "chunks_count"),
        serialization_alias="ChunksCount",
    )
    error: str = Field(
        default="",
        validation_alias=AliasChoices("Error", "error"),
        serialization_alias="Error",
    )
    ingested_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("IngestedAt", "ingested_at"),
        serialization_alias="IngestedAt",
    )
    prefilter_stats: dict = Field(
        default_factory=dict,
        validation_alias=AliasChoices("PreFilterStats", "prefilter_stats"),
        serialization_alias="PreFilterStats",
    )
    image_stats: dict = Field(
        default_factory=dict,
        validation_alias=AliasChoices("ImageStats", "image_stats"),
        serialization_alias="ImageStats",
    )


class MarkerBookBatchRow(BaseModel):
    """One queued / processed batch inside a Marker ingest job."""

    model_config = ConfigDict(populate_by_name=True)

    batch_id: int = Field(validation_alias=AliasChoices("BatchId", "batch_id"), serialization_alias="BatchId")
    batch_index: int = Field(
        validation_alias=AliasChoices("BatchIndex", "batch_index"),
        serialization_alias="BatchIndex",
    )
    page_start: int = Field(
        validation_alias=AliasChoices("PageStart", "page_start"),
        serialization_alias="PageStart",
    )
    page_end: int = Field(validation_alias=AliasChoices("PageEnd", "page_end"), serialization_alias="PageEnd")
    status: str = Field(validation_alias=AliasChoices("Status", "status"), serialization_alias="Status")
    error: str = Field(
        default="",
        validation_alias=AliasChoices("Error", "error"),
        serialization_alias="Error",
    )
    marker_stats: dict = Field(
        default_factory=dict,
        validation_alias=AliasChoices("MarkerStats", "marker_stats"),
        serialization_alias="MarkerStats",
    )
    created_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("CreatedAt", "created_at"),
        serialization_alias="CreatedAt",
    )


class MarkerBookJobRow(BaseModel):
    """Marker ingest job plus nested batch rows for a logical book."""

    model_config = ConfigDict(populate_by_name=True)

    job_id: int = Field(validation_alias=AliasChoices("JobId", "job_id"), serialization_alias="JobId")
    file_hash: str = Field(validation_alias=AliasChoices("FileHash", "file_hash"), serialization_alias="FileHash")
    filepath: str = Field(validation_alias=AliasChoices("Filepath", "filepath"), serialization_alias="Filepath")
    filename: str = Field(validation_alias=AliasChoices("Filename", "filename"), serialization_alias="Filename")
    total_pages: int = Field(
        validation_alias=AliasChoices("TotalPages", "total_pages"),
        serialization_alias="TotalPages",
    )
    batch_size: int = Field(
        validation_alias=AliasChoices("BatchSize", "batch_size"),
        serialization_alias="BatchSize",
    )
    status: str = Field(validation_alias=AliasChoices("Status", "status"), serialization_alias="Status")
    error: str = Field(
        default="",
        validation_alias=AliasChoices("Error", "error"),
        serialization_alias="Error",
    )
    ingest_meta: dict = Field(
        default_factory=dict,
        validation_alias=AliasChoices("IngestMeta", "ingest_meta"),
        serialization_alias="IngestMeta",
    )
    created_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("CreatedAt", "created_at"),
        serialization_alias="CreatedAt",
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("UpdatedAt", "updated_at"),
        serialization_alias="UpdatedAt",
    )
    batches: list[MarkerBookBatchRow] = Field(
        default_factory=list,
        validation_alias=AliasChoices("Batches", "batches"),
        serialization_alias="Batches",
    )


class MarkerBookInfoResponse(BaseModel):
    """Response for fetching all known ingest details for one logical book label."""

    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(
        validation_alias=AliasChoices("Status", "status"),
        serialization_alias="Status",
    )
    triggered_by: str = Field(
        validation_alias=AliasChoices("TriggeredBy", "triggered_by"),
        serialization_alias="TriggeredBy",
    )
    book_name: str = Field(
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
    )
    files_matched: int = Field(
        validation_alias=AliasChoices("FilesMatched", "files_matched"),
        serialization_alias="FilesMatched",
    )
    file_hashes: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("FileHashes", "file_hashes"),
        serialization_alias="FileHashes",
    )
    total_chunks: int = Field(
        validation_alias=AliasChoices("TotalChunks", "total_chunks"),
        serialization_alias="TotalChunks",
    )
    retrieval_items_total: int = Field(
        validation_alias=AliasChoices("RetrievalItemsTotal", "retrieval_items_total"),
        serialization_alias="RetrievalItemsTotal",
    )
    retrieval_text_items: int = Field(
        validation_alias=AliasChoices("RetrievalTextItems", "retrieval_text_items"),
        serialization_alias="RetrievalTextItems",
    )
    retrieval_image_items: int = Field(
        validation_alias=AliasChoices("RetrievalImageItems", "retrieval_image_items"),
        serialization_alias="RetrievalImageItems",
    )
    marker_jobs_total: int = Field(
        validation_alias=AliasChoices("MarkerJobsTotal", "marker_jobs_total"),
        serialization_alias="MarkerJobsTotal",
    )
    marker_batches_total: int = Field(
        validation_alias=AliasChoices("MarkerBatchesTotal", "marker_batches_total"),
        serialization_alias="MarkerBatchesTotal",
    )
    registry_rows: list[MarkerBookRegistryRow] = Field(
        default_factory=list,
        validation_alias=AliasChoices("RegistryRows", "registry_rows"),
        serialization_alias="RegistryRows",
    )
    jobs: list[MarkerBookJobRow] = Field(
        default_factory=list,
        validation_alias=AliasChoices("Jobs", "jobs"),
        serialization_alias="Jobs",
    )
    key_topics: list["EducationKeyTopicRow"] = Field(
        default_factory=list,
        validation_alias=AliasChoices("KeyTopics", "key_topics"),
        serialization_alias="KeyTopics",
    )


class MarkerIngestedBookPdfRow(BaseModel):
    """One ingested PDF entry with its logical book label."""

    model_config = ConfigDict(populate_by_name=True)

    book_name: str = Field(
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
    )
    pdf_name: str = Field(
        validation_alias=AliasChoices("PdfName", "pdf_name"),
        serialization_alias="PdfName",
    )


class MarkerIngestedBookPdfResponse(BaseModel):
    """Response for listing all ingested BookName / PdfName pairs."""

    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(
        validation_alias=AliasChoices("Status", "status"),
        serialization_alias="Status",
    )
    triggered_by: str = Field(
        validation_alias=AliasChoices("TriggeredBy", "triggered_by"),
        serialization_alias="TriggeredBy",
    )
    total_records: int = Field(
        validation_alias=AliasChoices("TotalRecords", "total_records"),
        serialization_alias="TotalRecords",
    )
    items: list[MarkerIngestedBookPdfRow] = Field(
        default_factory=list,
        validation_alias=AliasChoices("Items", "items"),
        serialization_alias="Items",
    )


class QueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(
        min_length=2,
        max_length=4000,
        validation_alias=AliasChoices("Question", "question"),
        serialization_alias="Question",
    )
    book_name: Optional[str] = Field(
        default=None,
        max_length=512,
        validation_alias=AliasChoices("BookName", "book_name"),
        serialization_alias="BookName",
        description="When set, retrieval is limited to chunks / vectors for this book label.",
    )
    include_outdated_books: bool = Field(
        default=False,
        validation_alias=AliasChoices("IncludeOutdatedBooks", "include_outdated_books"),
        serialization_alias="IncludeOutdatedBooks",
        description="When false (default), rows whose registry book_status is OutDated are excluded.",
    )

    @field_validator("book_name", mode="before")
    @classmethod
    def _strip_query_book_name(cls, v: object) -> object:
        if v is None:
            return None
        s = str(v).strip()
        return s or None
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
    retrieval_question: Optional[str] = Field(
        default=None,
        max_length=2000,
        validation_alias=AliasChoices("RetrievalQuestion", "retrieval_question"),
        serialization_alias="RetrievalQuestion",
        description=(
            "When set, drives retrieval / chunk keyword focus; Question is still passed to the LLM verbatim."
        ),
    )

    @field_validator("retrieval_question", mode="before")
    @classmethod
    def _strip_retrieval_question(cls, v: object) -> object:
        if v is None:
            return None
        s = str(v).strip()
        return s or None


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
    images: list[QueryResponseImageItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("Images", "images"),
        serialization_alias="Images",
        description="Top matched figures from Marker/S3 (vector path) or inline refs (FTS path).",
    )


class IngestResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(validation_alias=AliasChoices("Status", "status"), serialization_alias="Status")
    triggered_by: str = Field(
        validation_alias=AliasChoices("TriggeredBy", "triggered_by"),
        serialization_alias="TriggeredBy",
    )
    message: str = Field(
        default="",
        validation_alias=AliasChoices("Message", "message"),
        serialization_alias="Message",
    )
    file_hash: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("FileHash", "file_hash"),
        serialization_alias="FileHash",
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


class EducationBooksResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    books: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("Books", "books"),
        serialization_alias="Books",
    )


class EducationKeyTopicRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    label: str = Field(validation_alias=AliasChoices("Label", "label"), serialization_alias="Label")
    chunk_count: int = Field(
        validation_alias=AliasChoices("ChunkCount", "chunk_count"),
        serialization_alias="ChunkCount",
    )


class EducationKeyTopicsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    key_topics: list[EducationKeyTopicRow] = Field(
        default_factory=list,
        validation_alias=AliasChoices("KeyTopics", "key_topics"),
        serialization_alias="KeyTopics",
    )
