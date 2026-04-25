package com.flexshell.service;

import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.LlmChatPort;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AiChatServiceTest {

    @Test
    void escalatesWithoutCallingProviderForEmergency() {
        LlmChatPort provider = (history, message) -> "provider should not be used";
        AiChatService service = new AiChatService(provider, new AiSafetyPolicy(""));

        AiChatResponse response = service.reply("user-1", new AiChatRequest("I have chest pain", List.of()));
        assertTrue(response.escalated());
        assertTrue(response.reply().contains("urgent medical attention"));
    }

    @Test
    void enforcesDisclaimerOnProviderReply() {
        LlmChatPort provider = (history, message) -> "Paracetamol may help fever and body ache.";
        AiChatService service = new AiChatService(provider, new AiSafetyPolicy(""));

        AiChatResponse response = service.reply("user-1", new AiChatRequest("Can I take paracetamol?", List.of()));
        assertTrue(response.reply().contains(AiSafetyPolicy.DISCLAIMER_LINE));
        assertTrue(response.reply().toLowerCase().contains("not a doctor"));
    }
}
