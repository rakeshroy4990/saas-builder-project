package com.flexshell.controller.dto;

public record AiChatResponse(
        String reply,
        boolean escalated,
        String mode
) {
}
