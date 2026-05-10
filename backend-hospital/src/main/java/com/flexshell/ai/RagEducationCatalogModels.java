package com.flexshell.ai;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** JSON shape matches pdf-rag `/api/v1/education/*` responses. */
public final class RagEducationCatalogModels {
    private RagEducationCatalogModels() {
    }

    public record BooksPayload(@JsonProperty("Books") List<String> books) {
    }

    public record KeyTopicPayload(
            @JsonProperty("Label") String label,
            @JsonProperty("ChunkCount") long chunkCount
    ) {
    }

    public record KeyTopicsPayload(@JsonProperty("KeyTopics") List<KeyTopicPayload> keyTopics) {
    }
}
