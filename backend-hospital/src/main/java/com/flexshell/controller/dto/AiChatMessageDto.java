package com.flexshell.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiChatMessageDto(
        @NotBlank @Size(max = 32) String role,
        @NotBlank @Size(max = 2000) String content
) {
}
