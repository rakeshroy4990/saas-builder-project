package com.flexshell.ai;

import com.flexshell.controller.dto.AiChatMessageDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class PdfRagQueryAdapter {
    private final boolean enabled;
    private final String baseUrl;
    private final String queryPath;
    private final String educationBooksPath;
    private final String educationKeyTopicsPath;
    private final int retryAttempts;
    private final long retryBackoffMs;

    public PdfRagQueryAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.query-path:/api/v1/query}") String queryPath,
            @Value("${app.ai.rag.education-books-path:/api/v1/education/books}") String educationBooksPath,
            @Value("${app.ai.rag.education-key-topics-path:/api/v1/education/key-topics}") String educationKeyTopicsPath,
            @Value("${app.ai.rag.retry-attempts:2}") int retryAttempts,
            @Value("${app.ai.rag.retry-backoff-ms:600}") long retryBackoffMs
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.queryPath = queryPath == null ? "/api/v1/query" : queryPath.trim();
        this.educationBooksPath = educationBooksPath == null ? "/api/v1/education/books" : educationBooksPath.trim();
        this.educationKeyTopicsPath = educationKeyTopicsPath == null ? "/api/v1/education/key-topics" : educationKeyTopicsPath.trim();
        this.retryAttempts = Math.max(retryAttempts, 0);
        this.retryBackoffMs = Math.max(retryBackoffMs, 0L);
    }

    /**
     * Proxies to pdf-rag Doctor Studio catalog (requires Bearer JWT acceptable to pdf-rag).
     */
    public RagEducationCatalogModels.BooksPayload fetchEducationBooks(String authorizationHeader, boolean includeOutdated) {
        requireRagEnabledAndBaseUrl();
        String auth = requireBearer(authorizationHeader);
        RestClient client = RestClient.create(baseUrl);
        URI uri = UriComponentsBuilder.fromPath(normalizeApiPath(educationBooksPath))
                .queryParam("IncludeOutdated", includeOutdated)
                .build(false)
                .toUri();
        try {
            RagEducationCatalogModels.BooksPayload payload = client.get()
                    .uri(uri)
                    .headers(h -> h.set(HttpHeaders.AUTHORIZATION, auth))
                    .retrieve()
                    .body(RagEducationCatalogModels.BooksPayload.class);
            return normalizeBooksPayload(payload);
        } catch (RestClientResponseException ex) {
            throw ragCatalogException(ex);
        } catch (Exception ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Failed to call pdf-rag education books: " + ex.getMessage(),
                    "pdf-rag",
                    null,
                    "UNAVAILABLE"
            );
        }
    }

    public RagEducationCatalogModels.KeyTopicsPayload fetchEducationKeyTopics(
            String authorizationHeader,
            String bookName,
            int limit
    ) {
        requireRagEnabledAndBaseUrl();
        String auth = requireBearer(authorizationHeader);
        int lim = Math.max(1, Math.min(50, limit));
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath(normalizeApiPath(educationKeyTopicsPath))
                .queryParam("Limit", lim);
        String trimmedBook = bookName == null ? "" : bookName.trim();
        if (!trimmedBook.isEmpty()) {
            builder.queryParam("BookName", trimmedBook);
        }
        URI uri = builder.build(false).toUri();
        RestClient client = RestClient.create(baseUrl);
        try {
            RagEducationCatalogModels.KeyTopicsPayload payload = client.get()
                    .uri(uri)
                    .headers(h -> h.set(HttpHeaders.AUTHORIZATION, auth))
                    .retrieve()
                    .body(RagEducationCatalogModels.KeyTopicsPayload.class);
            return normalizeKeyTopicsPayload(payload);
        } catch (RestClientResponseException ex) {
            throw ragCatalogException(ex);
        } catch (Exception ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Failed to call pdf-rag education key-topics: " + ex.getMessage(),
                    "pdf-rag",
                    null,
                    "UNAVAILABLE"
            );
        }
    }

    private static RagEducationCatalogModels.BooksPayload normalizeBooksPayload(RagEducationCatalogModels.BooksPayload payload) {
        if (payload == null || payload.books() == null) {
            return new RagEducationCatalogModels.BooksPayload(List.of());
        }
        List<String> cleaned = payload.books().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.toList());
        return new RagEducationCatalogModels.BooksPayload(cleaned);
    }

    private static RagEducationCatalogModels.KeyTopicsPayload normalizeKeyTopicsPayload(RagEducationCatalogModels.KeyTopicsPayload payload) {
        if (payload == null || payload.keyTopics() == null) {
            return new RagEducationCatalogModels.KeyTopicsPayload(List.of());
        }
        List<RagEducationCatalogModels.KeyTopicPayload> rows = payload.keyTopics().stream()
                .filter(Objects::nonNull)
                .map(row -> new RagEducationCatalogModels.KeyTopicPayload(
                        row.label() == null ? "" : row.label().trim(),
                        row.chunkCount()
                ))
                .filter(row -> !row.label().isBlank())
                .collect(Collectors.toList());
        return new RagEducationCatalogModels.KeyTopicsPayload(rows);
    }

    private void requireRagEnabledAndBaseUrl() {
        if (!enabled) {
            throw new AiProviderException(AiProviderException.Kind.CONFIG_MISSING, "RAG adapter is disabled.");
        }
        if (baseUrl.isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.CONFIG_MISSING, "RAG base URL is not configured.");
        }
    }

    private static String requireBearer(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for RAG education catalog");
        }
        return authorizationHeader.trim();
    }

    private static String normalizeApiPath(String path) {
        String value = path == null ? "" : path.trim();
        return value.startsWith("/") ? value : "/" + value;
    }

    private static AiProviderException ragCatalogException(RestClientResponseException ex) {
        int statusCode = ex.getStatusCode().value();
        String friendlyMessage = statusCode == 429
                ? "Education catalog is handling high traffic right now. Please try again in a moment."
                : cleanCatalogProviderMessage(ex.getResponseBodyAsString());
        return new AiProviderException(
                AiProviderException.Kind.PROVIDER_FAILED,
                friendlyMessage,
                "pdf-rag",
                statusCode,
                ex.getStatusText()
        );
    }

    private static String cleanCatalogProviderMessage(String rawMessage) {
        String cleaned = String.valueOf(rawMessage == null ? "" : rawMessage)
                .replaceAll("[\\r\\n]+", " ")
                .trim();
        return cleaned.isEmpty() ? "Education catalog is temporarily unavailable." : cleaned;
    }

    private static Map<String, Object> buildRagQueryPayload(
            String message,
            String conversationId,
            List<AiChatMessageDto> history,
            String actorUserId,
            String bookName,
            String retrievalQuestion
    ) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("Question", message);
        body.put("ConversationId", normalizeConversationId(conversationId));
        body.put("History", toHistoryPayload(history));
        body.put("UserId", String.valueOf(actorUserId == null ? "" : actorUserId).trim());
        String bn = bookName == null ? "" : bookName.trim();
        if (!bn.isEmpty()) {
            body.put("BookName", bn);
        }
        String rq = retrievalQuestion == null ? "" : retrievalQuestion.trim();
        if (!rq.isEmpty()) {
            body.put("RetrievalQuestion", rq);
        }
        return body;
    }

    public RagQueryResult query(
            String message,
            String conversationId,
            List<AiChatMessageDto> history,
            String actorUserId,
            String authorizationHeader,
            List<String> userRoles,
            String bookName,
            String retrievalQuestion
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
                        .body(buildRagQueryPayload(message, conversationId, history, actorUserId, bookName, retrievalQuestion))
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
