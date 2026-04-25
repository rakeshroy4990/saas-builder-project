package com.flexshell.service;

import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.LlmChatPort;
import com.flexshell.controller.dto.AiChatRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;

class AiChatServiceAuthTest {
    @Test
    void rejectsUnauthenticatedCaller() {
        LlmChatPort provider = (history, message) -> "reply";
        AiChatService service = new AiChatService(provider, new AiSafetyPolicy(""));
        assertThrows(SecurityException.class, () -> service.reply("", new AiChatRequest("Hello", List.of())));
    }
}
