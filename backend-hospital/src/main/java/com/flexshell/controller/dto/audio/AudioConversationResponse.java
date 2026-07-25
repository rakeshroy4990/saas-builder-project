package com.flexshell.controller.dto.audio;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AudioConversationResponse(
        @JsonProperty("SessionId") String sessionId,
        @JsonProperty("AppointmentId") String appointmentId,
        @JsonProperty("Status") String status,
        @JsonProperty("DurationSeconds") Integer durationSeconds,
        @JsonProperty("ChunkCount") Integer chunkCount,
        @JsonProperty("LanguageDetected") String languageDetected,
        @JsonProperty("LanguageHint") String languageHint,
        @JsonProperty("AudioUrl") String audioUrl,
        @JsonProperty("TranscriptText") String transcriptText,
        @JsonProperty("Transcript") List<Map<String, Object>> transcript,
        @JsonProperty("SpeakersSwapped") Boolean speakersSwapped,
        @JsonProperty("StructuredJson") Map<String, Object> structuredJson,
        @JsonProperty("Summary") Map<String, Object> summary,
        @JsonProperty("Soap") Map<String, Object> soap,
        @JsonProperty("Prescription") Map<String, Object> prescription,
        @JsonProperty("Committed") Boolean committed
) {}
