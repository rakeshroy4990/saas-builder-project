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

    public PdfRagQueryAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.query-path:/api/v1/query}") String queryPath
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.queryPath = queryPath == null ? "/api/v1/query" : queryPath.trim();
    }

    public RagQueryResult query(
            String message,
            String conversationId,
            List<AiChatMessageDto> history,
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
        try {
            RestClient client = RestClient.create(baseUrl);
            String audience = resolveAudience(userRoles);
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
                                    "History", toHistoryPayload(history)
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
            if (answer.isEmpty()) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "RAG response did not include an answer.",
                        "pdf-rag",
                        null,
                        "EMPTY_ANSWER"
                );
            }
            return new RagQueryResult(answer, source);
        } catch (RestClientResponseException ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    ex.getResponseBodyAsString(),
                    "pdf-rag",
                    ex.getStatusCode().value(),
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

    public record RagQueryResult(String answer, String source) {
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
}
