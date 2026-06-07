package com.flexshell.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.AiSafetyPolicy;
import com.flexshell.ai.PdfRagQueryAdapter;
import com.flexshell.ai.SmartAiQuotaService;
import com.flexshell.controller.dto.AiChatMessageDto;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class AiChatService {
    private static final Logger LOG = LoggerFactory.getLogger(AiChatService.class);
    private final PdfRagQueryAdapter pdfRagQueryAdapter;
    private final AiSafetyPolicy safetyPolicy;
    private final SmartAiQuotaService smartAiQuotaService;
    private final ObjectMapper objectMapper;

    public AiChatService(
            PdfRagQueryAdapter pdfRagQueryAdapter,
            AiSafetyPolicy safetyPolicy,
            SmartAiQuotaService smartAiQuotaService,
            ObjectMapper objectMapper
    ) {
        this.pdfRagQueryAdapter = pdfRagQueryAdapter;
        this.safetyPolicy = safetyPolicy;
        this.smartAiQuotaService = smartAiQuotaService;
        this.objectMapper = objectMapper;
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
            throw new IllegalArgumentException("AI_CHAT_MESSAGE_REQUIRED");
        }
        if (isGreetingOnly(message)) {
            LOG.info("aiChat greeting actor={} messageLength={}", actor, messageLength);
            String greetingReply = "Hello! I am the AI Symptom Triage Assistant. Please share your symptoms and how long you have had them, and I can provide general guidance.\n\n"
                    + AiSafetyPolicy.NON_DOCTOR_LINE + "\n\n"
                    + AiSafetyPolicy.DISCLAIMER_LINE;
            return new AiChatResponse(greetingReply, false, "llm", List.of(), null, null, List.of(), List.of());
        }
        String audience = resolveAudience(userRoles);
        smartAiQuotaService.assertWithinTokenBudget(request);
        smartAiQuotaService.consumeDailyRequestOrThrow(actor);
        if (!"expert".equalsIgnoreCase(audience) && safetyPolicy.requiresEscalation(message)) {
            LOG.info("aiChat escalation actor={} messageLength={}", actor, messageLength);
            Optional<AiSafetyPolicy.EscalationType> escalationTypeOptional = safetyPolicy.detectEscalationType(message);
            AiSafetyPolicy.EscalationType escalationType =
                    escalationTypeOptional.orElse(AiSafetyPolicy.EscalationType.CARDIAC_RESPIRATORY);
            String escalationMessage = safetyPolicy.escalationReply(escalationType);
            return new AiChatResponse(escalationMessage, true, escalationType.name().toLowerCase(), List.of(), null, null, List.of(), List.of());
        }
        List<AiChatMessageDto> history = request.history() == null ? List.of() : request.history();
        LOG.info("aiChat request actor={} messageLength={} historyCount={}", actor, messageLength, history.size());
        String conversationId = resolveConversationId(actor, request.conversationId());
        PdfRagQueryAdapter.RagQueryResult ragResult = pdfRagQueryAdapter.query(
                message,
                conversationId,
                history,
                actor,
                authorizationHeader,
                userRoles,
                request.bookName(),
                request.retrievalQuestion());
        String rawReply = ragResult == null ? "" : Objects.toString(ragResult.answer(), "");
        String safeReply = "expert".equalsIgnoreCase(audience)
                ? rawReply.trim()
                : safetyPolicy.enforceSafeResponse(rawReply, message);
        LOG.info("aiChat response actor={} replyLength={}", actor, safeReply.length());
        boolean cache = "cache".equalsIgnoreCase(ragResult == null ? "" : ragResult.source());
        String mode = cache ? "rag_cache_" + audience : "rag_" + audience;
        List<String> followUpQuestions = ragResult == null || ragResult.followUpQuestions() == null
                ? List.of()
                : ragResult.followUpQuestions();
        return new AiChatResponse(
                safeReply,
                false,
                mode,
                followUpQuestions,
                ragResult == null ? null : ragResult.source(),
                ragResult == null ? null : ragResult.chunksUsed(),
                ragResult == null || ragResult.images() == null ? List.of() : ragResult.images(),
                ragResult == null || ragResult.reference() == null ? List.of() : ragResult.reference()
        );
    }

    /**
     * NDJSON stream (one JSON object per line): {@code ready}, {@code delta}, then {@code complete} with the same
     * field names as {@link AiChatResponse} (e.g. {@code reply}, {@code followUpQuestions}).
     */
    public StreamingResponseBody streamReply(String userId, AiChatRequest request, String authorizationHeader, List<String> userRoles) {
        String actor = Objects.toString(userId, "").trim();
        if (actor.isBlank()) {
            LOG.warn("aiChat stream denied unauthenticated request");
            throw new SecurityException("Not authenticated");
        }
        String message = Objects.toString(request.message(), "").trim();
        int messageLength = message.length();
        if (message.isBlank()) {
            LOG.warn("aiChat stream invalid empty message actor={}", actor);
            throw new IllegalArgumentException("AI_CHAT_MESSAGE_REQUIRED");
        }
        String audience = resolveAudience(userRoles);
        if (isGreetingOnly(message)) {
            LOG.info("aiChat stream greeting actor={} messageLength={}", actor, messageLength);
            String greetingReply = "Hello! I am the AI Symptom Triage Assistant. Please share your symptoms and how long you have had them, and I can provide general guidance.\n\n"
                    + AiSafetyPolicy.NON_DOCTOR_LINE + "\n\n"
                    + AiSafetyPolicy.DISCLAIMER_LINE;
            AiChatResponse r = new AiChatResponse(greetingReply, false, "llm", List.of(), null, null, List.of(), List.of());
            return out -> writeNdjsonComplete(out, r);
        }
        smartAiQuotaService.assertWithinTokenBudget(request);
        smartAiQuotaService.consumeDailyRequestOrThrow(actor);
        if (!"expert".equalsIgnoreCase(audience) && safetyPolicy.requiresEscalation(message)) {
            LOG.info("aiChat stream escalation actor={} messageLength={}", actor, messageLength);
            Optional<AiSafetyPolicy.EscalationType> escalationTypeOptional = safetyPolicy.detectEscalationType(message);
            AiSafetyPolicy.EscalationType escalationType =
                    escalationTypeOptional.orElse(AiSafetyPolicy.EscalationType.CARDIAC_RESPIRATORY);
            String escalationMessage = safetyPolicy.escalationReply(escalationType);
            AiChatResponse r = new AiChatResponse(escalationMessage, true, escalationType.name().toLowerCase(), List.of(), null, null, List.of(), List.of());
            return out -> writeNdjsonComplete(out, r);
        }
        List<AiChatMessageDto> history = request.history() == null ? List.of() : request.history();
        String conversationId = resolveConversationId(actor, request.conversationId());
        LOG.info("aiChat stream request actor={} messageLength={} historyCount={}", actor, messageLength, history.size());
        return outputStream -> {
            AtomicBoolean firstLineFromRag = new AtomicBoolean(true);
            AtomicBoolean firstDeltaFromRag = new AtomicBoolean(true);
            AtomicLong streamStartMs = new AtomicLong(System.currentTimeMillis());
            try {
                pdfRagQueryAdapter.streamQueryNdjson(
                        message,
                        conversationId,
                        history,
                        actor,
                        authorizationHeader,
                        userRoles,
                        request.bookName(),
                        request.retrievalQuestion(),
                        line -> {
                            try {
                                if (firstLineFromRag.compareAndSet(true, false)) {
                                    LOG.info(
                                            "FIRST_LINE_FROM_FASTAPI_MS={}",
                                            System.currentTimeMillis() - streamStartMs.get()
                                    );
                                }
                                writeTransformedNdjsonLine(
                                        outputStream, line, audience, message, streamStartMs, firstDeltaFromRag
                                );
                            } catch (IOException ex) {
                                throw new UncheckedIOException(ex);
                            }
                        }
                );
            } catch (Exception ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                if (ex instanceof RuntimeException re) {
                    throw re;
                }
                throw new IllegalStateException(ex);
            }
        };
    }

    private void forwardNdjsonLine(OutputStream outputStream, String line) throws IOException {
        outputStream.write((line + "\n").getBytes(StandardCharsets.UTF_8));
        outputStream.flush();
    }

    private void writeTransformedNdjsonLine(
            OutputStream outputStream,
            String line,
            String audience,
            String userMessage,
            AtomicLong streamStartMs,
            AtomicBoolean firstDeltaFromRag
    ) throws IOException {
        JsonNode root = objectMapper.readTree(line);
        String type = root.path("type").asText("").trim().toLowerCase(Locale.ROOT);
        if (("delta".equals(type) || "token".equals(type)) && firstDeltaFromRag.compareAndSet(true, false)) {
            LOG.info("FIRST_DELTA_FROM_FASTAPI_MS={}", System.currentTimeMillis() - streamStartMs.get());
        }
        if ("error".equals(type)) {
            String msg = root.path("data").path("message").asText("stream_error");
            throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, msg, "pdf-rag", null, "STREAM");
        }
        // Token/delta chunks from pdf-rag (and ready/ping) — pass through immediately for real-time UI.
        if ("token".equals(type) || "delta".equals(type) || "ready".equals(type) || "ping".equals(type) || "status".equals(type)) {
            forwardNdjsonLine(outputStream, line);
            return;
        }
        if (!"complete".equals(type)) {
            forwardNdjsonLine(outputStream, line);
            return;
        }
        JsonNode data = root.get("data");
        if (data == null || !data.isObject()) {
            forwardNdjsonLine(outputStream, line);
            return;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> dataMap = objectMapper.convertValue(data, Map.class);
        PdfRagQueryAdapter.RagQueryResult rag = pdfRagQueryAdapter.toRagQueryResult(dataMap);
        String safeReply = "expert".equalsIgnoreCase(audience)
                ? rag.answer().trim()
                : safetyPolicy.enforceSafeResponse(rag.answer(), userMessage);
        boolean cache = "cache".equalsIgnoreCase(rag.source());
        String mode = cache ? "rag_cache_" + audience.toLowerCase(Locale.ROOT) : "rag_" + audience.toLowerCase(Locale.ROOT);
        AiChatResponse response = new AiChatResponse(
                safeReply,
                false,
                mode,
                rag.followUpQuestions() == null ? List.of() : rag.followUpQuestions(),
                rag.source(),
                rag.chunksUsed(),
                rag.images() == null ? List.of() : rag.images(),
                rag.reference() == null ? List.of() : rag.reference()
        );
        writeNdjsonComplete(outputStream, response);
    }

    private void writeNdjsonComplete(OutputStream out, AiChatResponse r) throws IOException {
        Map<String, Object> data = objectMapper.convertValue(r, new TypeReference<>() { });
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("type", "complete");
        wrapper.put("data", data);
        objectMapper.writeValue(out, wrapper);
        out.write('\n');
        out.flush();
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
