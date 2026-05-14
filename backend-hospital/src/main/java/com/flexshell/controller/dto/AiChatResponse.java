package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AiChatResponse(
        String reply,
        boolean escalated,
        String mode,
        List<String> followUpQuestions,
        String source,
        Integer chunksUsed,
        List<AiChatFigureDto> images,
        @JsonProperty("Reference") List<AiChatReferenceDto> reference
) {
}
