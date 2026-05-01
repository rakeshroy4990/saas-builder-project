package com.flexshell.ai;

import com.flexshell.controller.dto.AiChatMessageDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class PdfRagQueryAdapter {
    private final boolean enabled;
    private final String baseUrl;
    private final String queryPath;
    private final int retryAttempts;
    private final long retryBackoffMs;

    public PdfRagQueryAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.query-path:/api/v1/query}") String queryPath,
            @Value("${app.ai.rag.retry-attempts:2}") int retryAttempts,
            @Value("${app.ai.rag.retry-backoff-ms:600}") long retryBackoffMs
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.queryPath = queryPath == null ? "/api/v1/query" : queryPath.trim();
        this.retryAttempts = Math.max(retryAttempts, 0);
        this.retryBackoffMs = Math.max(retryBackoffMs, 0L);
    }

    public RagQueryResult query(
            String message,
            String conversationId,
            List<AiChatMessageDto> history,
            String actorUserId,
            String authorizationHeader,
            List<String> userRoles
    ) {
        if (!enabled) {
            throw new AiProviderException(AiProviderException.Kind.CONFIG_MISSING, "RAG adapter is disabled.");
        }
        if (baseUrl.isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.CONFIG_MISSING, "RAG base URL is not configured.");
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for RAG query");
        }
        RestClient client = RestClient.create(baseUrl);
        String audience = resolveAudience(userRoles);
        for (int attempt = 0; ; attempt++) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> response = client.post()
                        .uri(queryPath)
                        .headers(h -> {
                            h.set("Authorization", authorizationHeader);
                            if (userRoles != null && !userRoles.isEmpty()) {
                                h.set("X-User-Roles", userRoles.stream().collect(Collectors.joining(",")));
                            }
                            h.set("X-User-Audience", audience);
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(
                                Map.of(
                                        "Question", message,
                                        "ConversationId", normalizeConversationId(conversationId),
                                        "History", toHistoryPayload(history),
                                        "UserId", String.valueOf(actorUserId == null ? "" : actorUserId).trim()
                                )
                        )
                        .retrieve()
                        .body(Map.class);

                String answer = response == null ? "" : String.valueOf(response.getOrDefault("Answer", "")).trim();
                if (answer.isEmpty()) {
                    answer = response == null ? "" : String.valueOf(response.getOrDefault("answer", "")).trim();
                }
                String source = response == null ? "" : String.valueOf(response.getOrDefault("Source", "")).trim();
                if (source.isEmpty()) {
                    source = response == null ? "" : String.valueOf(response.getOrDefault("source", "")).trim();
                }
                List<String> followUpQuestions = parseFollowUpQuestions(response);
                if (answer.isEmpty()) {
                    throw new AiProviderException(
                            AiProviderException.Kind.PROVIDER_FAILED,
                            "RAG response did not include an answer.",
                            "pdf-rag",
                            null,
                            "EMPTY_ANSWER"
                    );
                }
                return new RagQueryResult(answer, source, followUpQuestions);
            } catch (RestClientResponseException ex) {
                int statusCode = ex.getStatusCode().value();
                boolean retryable = statusCode == 429 || statusCode == 503;
                if (retryable && attempt < retryAttempts) {
                    sleepQuietly(retryBackoffMs * (attempt + 1));
                    continue;
                }
                String friendlyMessage = statusCode == 429
                        ? "Smart AI is handling high traffic right now. Please try again in a moment."
                        : cleanProviderMessage(ex.getResponseBodyAsString());
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        friendlyMessage,
                        "pdf-rag",
                        statusCode,
                        ex.getStatusText()
                );
            } catch (AiProviderException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "Failed to call pdf-rag query endpoint: " + ex.getMessage(),
                        "pdf-rag",
                        null,
                        "UNAVAILABLE"
                );
            }
        }
    }

    public record RagQueryResult(String answer, String source, List<String> followUpQuestions) {
    }

    @SuppressWarnings("unchecked")
    private static List<String> parseFollowUpQuestions(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return List.of();
        }
        Object raw = response.get("FollowUpQuestions");
        if (!(raw instanceof List<?>)) {
            raw = response.get("follow_up_questions");
        }
        if (!(raw instanceof List<?> items)) {
            return List.of();
        }
        return items.stream()
                .map(value -> String.valueOf(value == null ? "" : value).trim())
                .filter(value -> !value.isBlank())
                .distinct()
                .limit(6)
                .collect(Collectors.toList());
    }

    private static String resolveAudience(List<String> userRoles) {
        if (userRoles == null || userRoles.isEmpty()) {
            return "layman";
        }
        for (String role : userRoles) {
            String normalized = String.valueOf(role == null ? "" : role).trim().toUpperCase();
            if (normalized.equals("ROLE_ADMIN") || normalized.equals("ROLE_DOCTOR") || normalized.equals("ROLE_CLINICIAN")) {
                return "expert";
            }
        }
        return "layman";
    }

    private static String normalizeConversationId(String conversationId) {
        String value = String.valueOf(conversationId == null ? "" : conversationId).trim();
        return value.isEmpty() ? "default" : value;
    }

    private static List<Map<String, String>> toHistoryPayload(List<AiChatMessageDto> history) {
        if (history == null || history.isEmpty()) {
            return List.of();
        }
        return history.stream()
                .map(item -> Map.of(
                        "Role", String.valueOf(item.role() == null ? "" : item.role()).trim(),
                        "Content", String.valueOf(item.content() == null ? "" : item.content()).trim()
                ))
                .collect(Collectors.toList());
    }

    private static String cleanProviderMessage(String rawMessage) {
        String cleaned = String.valueOf(rawMessage == null ? "" : rawMessage)
                .replaceAll("[\\r\\n]+", " ")
                .trim();
        return cleaned.isEmpty() ? "Smart AI provider is temporarily unavailable." : cleaned;
    }

    private static void sleepQuietly(long millis) {
        if (millis <= 0) {
            return;
        }
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}
