package com.flexshell.service;

import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.PdfRagQueryAdapter;
import com.flexshell.ai.SmartAiQuotaService;
import com.flexshell.controller.dto.AiChatRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class AiChatServiceAuthTest {
    @Test
    void rejectsUnauthenticatedCaller() {
        PdfRagQueryAdapter ragAdapter = mock(PdfRagQueryAdapter.class);
        SmartAiQuotaService quota = new SmartAiQuotaService(10_000, Integer.MAX_VALUE, null);
        AiChatService service = new AiChatService(ragAdapter, new AiSafetyPolicy(""), quota);
        assertThrows(SecurityException.class, () -> service.reply("", new AiChatRequest("Hello", null, List.of()), "Bearer token", List.of("ROLE_USER")));
    }
}
