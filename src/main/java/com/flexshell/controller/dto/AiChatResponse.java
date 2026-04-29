package com.flexshell.controller.dto;

import java.util.List;

public record AiChatResponse(
        String reply,
        boolean escalated,
        String mode,
        List<String> followUpQuestions
) {
}
