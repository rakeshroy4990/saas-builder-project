package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiChatResponse(
        @JsonProperty("Reply") String reply,
        @JsonProperty("Escalated") boolean escalated,
        @JsonProperty("Mode") String mode,
        @JsonProperty("FollowUpQuestions") List<String> followUpQuestions,
        @JsonProperty("Source") String source,
        @JsonProperty("ChunksUsed") Integer chunksUsed,
        @JsonProperty("Images") List<AiChatFigureDto> images,
        @JsonProperty("Reference") List<AiChatReferenceDto> reference,
        @JsonProperty("DetectedLocale") String detectedLocale,
        @JsonProperty("AnswerEnglish") String answerEnglish,
        @JsonProperty("ShowTranslationToggle") boolean showTranslationToggle,
        @JsonProperty("EmergencyCall108") boolean emergencyCall108
) {
    public AiChatResponse(
            String reply,
            boolean escalated,
            String mode,
            List<String> followUpQuestions,
            String source,
            Integer chunksUsed,
            List<AiChatFigureDto> images,
            List<AiChatReferenceDto> reference
    ) {
        this(reply, escalated, mode, followUpQuestions, source, chunksUsed, images, reference,
                "en", null, false, false);
    }
}
