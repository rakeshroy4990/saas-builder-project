package com.flexshell.service;

import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.PdfRagQueryAdapter;
import com.flexshell.ai.SmartAiQuotaService;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiChatServiceTest {

    private static SmartAiQuotaService unlimitedQuota() {
        return new SmartAiQuotaService(10_000, Integer.MAX_VALUE, null);
    }

    @Test
    void escalatesWithoutCallingProviderForEmergency() {
        PdfRagQueryAdapter ragAdapter = mock(PdfRagQueryAdapter.class);
        AiChatService service = new AiChatService(ragAdapter, new AiSafetyPolicy(""), unlimitedQuota());

        AiChatResponse response = service.reply("user-1", new AiChatRequest("I have chest pain", null, List.of()), "Bearer token", List.of("ROLE_USER"));
        assertTrue(response.escalated());
        assertTrue(response.reply().contains("urgent medical attention"));
    }

    @Test
    void enforcesDisclaimerOnProviderReply() {
        PdfRagQueryAdapter ragAdapter = mock(PdfRagQueryAdapter.class);
        when(ragAdapter.query(anyString(), anyString(), anyList(), anyString(), anyList()))
                .thenReturn(new PdfRagQueryAdapter.RagQueryResult("Paracetamol may help fever and body ache.", "rag"));
        AiChatService service = new AiChatService(ragAdapter, new AiSafetyPolicy(""), unlimitedQuota());

        AiChatResponse response = service.reply("user-1", new AiChatRequest("Can I take paracetamol?", "conv-1", List.of()), "Bearer token", List.of("ROLE_USER"));
        assertTrue(response.reply().contains(AiSafetyPolicy.DISCLAIMER_LINE));
        assertTrue(response.reply().toLowerCase().contains("not a doctor"));
        assertEquals("rag_layman", response.mode());
    }

    @Test
    void marksModeAsRagCacheWhenSourceIsCache() {
        PdfRagQueryAdapter ragAdapter = mock(PdfRagQueryAdapter.class);
        when(ragAdapter.query(anyString(), anyString(), anyList(), anyString(), anyList()))
                .thenReturn(new PdfRagQueryAdapter.RagQueryResult("Not enough information in knowledge base.", "cache"));
        AiChatService service = new AiChatService(ragAdapter, new AiSafetyPolicy(""), unlimitedQuota());

        AiChatResponse response = service.reply("user-1", new AiChatRequest("I have dengue", null, List.of()), "Bearer token", List.of("ROLE_DOCTOR"));
        assertEquals("rag_cache_expert", response.mode());
    }
}
