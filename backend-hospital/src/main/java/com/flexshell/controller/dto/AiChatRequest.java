package com.flexshell.controller.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AiChatRequest(
        @NotBlank @Size(max = 2000) String message,
        @Valid @Size(max = 12) List<AiChatMessageDto> history
) {
}
