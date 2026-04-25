package com.flexshell.service;

import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.LlmChatPort;
import com.flexshell.controller.dto.AiChatMessageDto;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class AiChatService {
    private static final Logger LOG = LoggerFactory.getLogger(AiChatService.class);
    private final LlmChatPort llmChatPort;
    private final AiSafetyPolicy safetyPolicy;

    public AiChatService(LlmChatPort llmChatPort, AiSafetyPolicy safetyPolicy) {
        this.llmChatPort = llmChatPort;
        this.safetyPolicy = safetyPolicy;
    }

    public AiChatResponse reply(String userId, AiChatRequest request) {
        String actor = Objects.toString(userId, "").trim();
        if (actor.isBlank()) {
            LOG.warn("aiChat denied unauthenticated request");
            throw new SecurityException("Not authenticated");
        }
        String message = Objects.toString(request.message(), "").trim();
        int messageLength = message.length();
        if (message.isBlank()) {
            LOG.warn("aiChat invalid empty message actor={} historyCount={}", actor, request.history() == null ? 0 : request.history().size());
            throw new IllegalArgumentException("Message is required");
        }
        if (isGreetingOnly(message)) {
            LOG.info("aiChat greeting actor={} messageLength={}", actor, messageLength);
            String greetingReply = "Hello! I am the AI Symptom Triage Assistant. Please share your symptoms and how long you have had them, and I can provide general guidance.\n\n"
                    + AiSafetyPolicy.NON_DOCTOR_LINE + "\n\n"
                    + AiSafetyPolicy.DISCLAIMER_LINE;
            return new AiChatResponse(greetingReply, false, "llm");
        }
        if (safetyPolicy.requiresEscalation(message)) {
            LOG.info("aiChat escalation actor={} messageLength={}", actor, messageLength);
            return new AiChatResponse(safetyPolicy.escalationReply(), true, "escalation");
        }
        List<AiChatMessageDto> history = request.history() == null ? List.of() : request.history();
        LOG.info("aiChat request actor={} messageLength={} historyCount={}", actor, messageLength, history.size());
        String rawReply = llmChatPort.complete(history, message);
        String safeReply = safetyPolicy.enforceSafeResponse(rawReply);
        LOG.info("aiChat response actor={} replyLength={}", actor, safeReply.length());
        return new AiChatResponse(safeReply, false, "llm");
    }

    private static boolean isGreetingOnly(String message) {
        String normalized = message.toLowerCase(Locale.ROOT).trim();
        if (normalized.isBlank()) return false;
        return normalized.matches("^(hi|hello|hey|hii|hola|good morning|good afternoon|good evening)[.!?]*$");
    }
}
