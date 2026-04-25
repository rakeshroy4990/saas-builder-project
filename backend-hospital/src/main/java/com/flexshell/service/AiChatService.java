package com.flexshell.service;

import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.PdfRagQueryAdapter;
import com.flexshell.ai.SmartAiQuotaService;
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
    private final PdfRagQueryAdapter pdfRagQueryAdapter;
    private final AiSafetyPolicy safetyPolicy;
    private final SmartAiQuotaService smartAiQuotaService;

    public AiChatService(
            PdfRagQueryAdapter pdfRagQueryAdapter,
            AiSafetyPolicy safetyPolicy,
            SmartAiQuotaService smartAiQuotaService
    ) {
        this.pdfRagQueryAdapter = pdfRagQueryAdapter;
        this.safetyPolicy = safetyPolicy;
        this.smartAiQuotaService = smartAiQuotaService;
    }

    public AiChatResponse reply(String userId, AiChatRequest request, String authorizationHeader, List<String> userRoles) {
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
        smartAiQuotaService.assertWithinTokenBudget(request);
        smartAiQuotaService.consumeDailyRequestOrThrow(actor);
        if (safetyPolicy.requiresEscalation(message)) {
            LOG.info("aiChat escalation actor={} messageLength={}", actor, messageLength);
            return new AiChatResponse(safetyPolicy.escalationReply(), true, "escalation");
        }
        List<AiChatMessageDto> history = request.history() == null ? List.of() : request.history();
        LOG.info("aiChat request actor={} messageLength={} historyCount={}", actor, messageLength, history.size());
        String conversationId = resolveConversationId(actor, request.conversationId());
        PdfRagQueryAdapter.RagQueryResult ragResult =
                pdfRagQueryAdapter.query(message, conversationId, history, authorizationHeader, userRoles);
        String rawReply = ragResult == null ? "" : Objects.toString(ragResult.answer(), "");
        String safeReply = safetyPolicy.enforceSafeResponse(rawReply);
        LOG.info("aiChat response actor={} replyLength={}", actor, safeReply.length());
        boolean cache = "cache".equalsIgnoreCase(ragResult == null ? "" : ragResult.source());
        String audience = resolveAudience(userRoles);
        String mode = cache ? "rag_cache_" + audience : "rag_" + audience;
        return new AiChatResponse(safeReply, false, mode);
    }

    private static String resolveAudience(List<String> userRoles) {
        if (userRoles == null || userRoles.isEmpty()) {
            return "layman";
        }
        for (String role : userRoles) {
            String normalized = String.valueOf(role == null ? "" : role).trim().toUpperCase(Locale.ROOT);
            if (normalized.equals("ROLE_ADMIN") || normalized.equals("ROLE_DOCTOR") || normalized.equals("ROLE_CLINICIAN")) {
                return "expert";
            }
        }
        return "layman";
    }

    private static String resolveConversationId(String actor, String requestedConversationId) {
        String explicit = Objects.toString(requestedConversationId, "").trim();
        if (!explicit.isBlank()) {
            return explicit;
        }
        String userScope = Objects.toString(actor, "").trim();
        return userScope.isBlank() ? "default" : "chat-" + userScope;
    }

    private static boolean isGreetingOnly(String message) {
        String normalized = message.toLowerCase(Locale.ROOT).trim();
        if (normalized.isBlank()) return false;
        return normalized.matches("^(hi|hello|hey|hii|hola|good morning|good afternoon|good evening)[.!?]*$");
    }
}
