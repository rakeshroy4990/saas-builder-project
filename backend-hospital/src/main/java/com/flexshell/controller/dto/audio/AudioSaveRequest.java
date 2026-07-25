package com.flexshell.controller.dto.audio;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public record AudioSaveRequest(
        @JsonProperty("SessionId") String sessionId,
        @JsonProperty("TranscriptText") String transcriptText,
        @JsonProperty("Transcript") List<Map<String, Object>> transcript,
        @JsonProperty("StructuredJson") Map<String, Object> structuredJson,
        @JsonProperty("Summary") Map<String, Object> summary,
        @JsonProperty("Soap") Map<String, Object> soap,
        @JsonProperty("Prescription") Map<String, Object> prescription
) {}
