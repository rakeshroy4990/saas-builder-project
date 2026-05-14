package com.flexshell.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AiChatFigureDto;
import com.flexshell.controller.dto.AiChatMessageDto;
import com.flexshell.controller.dto.AiChatReferenceDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Component
public class PdfRagQueryAdapter {
    private static final Logger LOG = LoggerFactory.getLogger(PdfRagQueryAdapter.class);

    private final boolean enabled;
    private final String baseUrl;
    private final String queryPath;
    private final String queryStreamPath;
    private final String educationBooksPath;
    private final String educationKeyTopicsPath;
    private final int retryAttempts;
    private final long retryBackoffMs;
    private final ObjectMapper objectMapper;
    /** Shared client for NDJSON streaming to pdf-rag (avoids new TCP connect per request). */
    private final HttpClient streamingHttpClient;

    public PdfRagQueryAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.query-path:/api/v1/query}") String queryPath,
            @Value("${app.ai.rag.education-books-path:/api/v1/education/books}") String educationBooksPath,
            @Value("${app.ai.rag.education-key-topics-path:/api/v1/education/key-topics}") String educationKeyTopicsPath,
            @Value("${app.ai.rag.retry-attempts:2}") int retryAttempts,
            @Value("${app.ai.rag.retry-backoff-ms:600}") long retryBackoffMs,
            @Value("${app.ai.rag.query-stream-path:}") String queryStreamPathOverride,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.queryPath = queryPath == null ? "/api/v1/query" : queryPath.trim();
        String qp = normalizeApiPath(this.queryPath);
        String override = queryStreamPathOverride == null ? "" : queryStreamPathOverride.trim();
        this.queryStreamPath = override.isEmpty() ? qp + "/stream" : normalizeApiPath(override);
        this.educationBooksPath = educationBooksPath == null ? "/api/v1/education/books" : educationBooksPath.trim();
        this.educationKeyTopicsPath = educationKeyTopicsPath == null ? "/api/v1/education/key-topics" : educationKeyTopicsPath.trim();
        this.retryAttempts = Math.max(retryAttempts, 0);
        this.retryBackoffMs = Math.max(retryBackoffMs, 0L);
        this.objectMapper = objectMapper;
        this.streamingHttpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(25))
                .build();
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
                Integer chunksUsed = parseIntegerField(response, "ChunksUsed", "chunks_used");
                List<AiChatFigureDto> images = parseImages(response);
                List<AiChatReferenceDto> reference = parseReferences(response);
                if (answer.isEmpty()) {
                    throw new AiProviderException(
                            AiProviderException.Kind.PROVIDER_FAILED,
                            "RAG response did not include an answer.",
                            "pdf-rag",
                            null,
                            "EMPTY_ANSWER"
                    );
                }
                return new RagQueryResult(answer, source, followUpQuestions, chunksUsed, images, reference);
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
                URI u = URI.create(joinBaseAndPath(baseUrl, queryPath));
                if (isRagTcpOrDnsFailure(ex)) {
                    LOG.error("pdf_rag_connect_failed uri={} message={}", u, ex.toString());
                    throw new AiProviderException(
                            AiProviderException.Kind.PROVIDER_FAILED,
                            ragUnreachableUserMessage(u),
                            "pdf-rag",
                            null,
                            "CONNECT"
                    );
                }
                LOG.error("pdf_rag_query_failed uri={} message={}", u, ex.toString());
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

    /**
     * Calls pdf-rag {@code POST .../query/stream} and invokes {@code onLine} for each NDJSON line (no trailing newline).
     * Retries are not applied (streaming bodies are not replay-safe).
     */
    public void streamQueryNdjson(
            String message,
            String conversationId,
            List<AiChatMessageDto> history,
            String actorUserId,
            String authorizationHeader,
            List<String> userRoles,
            String bookName,
            String retrievalQuestion,
            java.util.function.Consumer<String> onLine
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
        String audience = resolveAudience(userRoles);
        final String json;
        try {
            json = objectMapper.writeValueAsString(
                    buildRagQueryPayload(message, conversationId, history, actorUserId, bookName, retrievalQuestion)
            );
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Could not build RAG request JSON: " + ex.getMessage(),
                    "pdf-rag",
                    null,
                    "SERIALIZE"
            );
        }
        URI uri = URI.create(joinBaseAndPath(baseUrl, queryStreamPath));
        HttpRequest.Builder rb = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMinutes(12))
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader.trim())
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("X-User-Audience", audience)
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
        if (userRoles != null && !userRoles.isEmpty()) {
            rb.header("X-User-Roles", userRoles.stream().collect(Collectors.joining(",")));
        }
        final HttpResponse<InputStream> resp;
        try {
            resp = streamingHttpClient.send(rb.build(), HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "RAG stream request was interrupted.",
                    "pdf-rag",
                    null,
                    "INTERRUPTED"
            );
        } catch (IOException ex) {
            if (isRagTcpOrDnsFailure(ex)) {
                LOG.error("pdf_rag_stream_connect_failed uri={} message={}", uri, ex.toString());
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        ragUnreachableUserMessage(uri),
                        "pdf-rag",
                        null,
                        "CONNECT"
                );
            }
            LOG.error("pdf_rag_stream_io_failed uri={} message={}", uri, ex.toString());
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "RAG stream I/O failed: " + ex.getMessage(),
                    "pdf-rag",
                    null,
                    "IO"
            );
        }
        int code = resp.statusCode();
        if (code != 200) {
            String errBody = "";
            try (InputStream in = resp.body()) {
                errBody = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException ex) {
                LOG.warn("pdf_rag_stream_error_body_read_failed uri={} status={} message={}", uri, code, ex.toString());
            }
            String friendlyMessage = code == 429
                    ? "Smart AI is handling high traffic right now. Please try again in a moment."
                    : cleanProviderMessage(errBody);
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    friendlyMessage,
                    "pdf-rag",
                    code,
                    ""
            );
        }
        try (InputStream raw = resp.body();
             BufferedReader br = new BufferedReader(new InputStreamReader(raw, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (!line.isBlank()) {
                    onLine.accept(line);
                }
            }
        } catch (IOException ex) {
            LOG.error("pdf_rag_stream_read_failed uri={} message={}", uri, ex.toString());
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "RAG stream read failed: " + ex.getMessage(),
                    "pdf-rag",
                    null,
                    "STREAM_READ"
            );
        }
    }

    private static String joinBaseAndPath(String base, String path) {
        String b = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        String p = path.startsWith("/") ? path : "/" + path;
        return b + p;
    }

    /**
     * True when the JVM could not open a TCP connection or resolve the host (typical local dev: pdf-rag not running).
     */
    private static boolean isRagTcpOrDnsFailure(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ConnectException) {
                return true;
            }
            if (t instanceof HttpConnectTimeoutException) {
                return true;
            }
            if (t instanceof java.nio.channels.UnresolvedAddressException) {
                return true;
            }
            String name = t.getClass().getName();
            if (name.contains("ConnectException") || name.contains("UnresolvedAddressException")) {
                return true;
            }
        }
        return false;
    }

    private static String ragUnreachableUserMessage(URI uri) {
        return "Cannot reach the PDF RAG service at "
                + uri
                + ". Start the pdf-rag-pipeline (default http://localhost:8090) or set APP_AI_RAG_BASE_URL to the correct base URL.";
    }

    /**
     * Same field extraction as {@link #query} for a single JSON object (e.g. stream {@code complete} payload).
     */
    public RagQueryResult toRagQueryResult(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "RAG stream payload was empty.",
                    "pdf-rag",
                    null,
                    "EMPTY_STREAM"
            );
        }
        String answer = String.valueOf(response.getOrDefault("Answer", "")).trim();
        if (answer.isEmpty()) {
            answer = String.valueOf(response.getOrDefault("answer", "")).trim();
        }
        String source = String.valueOf(response.getOrDefault("Source", "")).trim();
        if (source.isEmpty()) {
            source = String.valueOf(response.getOrDefault("source", "")).trim();
        }
        List<String> followUpQuestions = parseFollowUpQuestions(response);
        Integer chunksUsed = parseIntegerField(response, "ChunksUsed", "chunks_used");
        List<AiChatFigureDto> images = parseImages(response);
        List<AiChatReferenceDto> reference = parseReferences(response);
        if (answer.isEmpty()) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "RAG response did not include an answer.",
                    "pdf-rag",
                    null,
                    "EMPTY_ANSWER"
            );
        }
        return new RagQueryResult(answer, source, followUpQuestions, chunksUsed, images, reference);
    }

    public record RagQueryResult(
            String answer,
            String source,
            List<String> followUpQuestions,
            Integer chunksUsed,
            List<AiChatFigureDto> images,
            List<AiChatReferenceDto> reference
    ) {
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

    @SuppressWarnings("unchecked")
    private static List<AiChatFigureDto> parseImages(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return List.of();
        }
        Object raw = response.get("Images");
        if (!(raw instanceof List<?>)) {
            raw = response.get("images");
        }
        if (!(raw instanceof List<?> items)) {
            return List.of();
        }
        List<AiChatFigureDto> out = new ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> rawMap)) {
                continue;
            }
            Map<String, Object> map = rawMap.entrySet().stream()
                    .filter(e -> e.getKey() != null)
                    .collect(Collectors.toMap(
                            e -> String.valueOf(e.getKey()),
                            Map.Entry::getValue,
                            (a, b) -> b,
                            LinkedHashMap::new
                    ));
            out.add(new AiChatFigureDto(
                    parseIntegerField(map, "ImgIndex", "img_index"),
                    parseIntegerField(map, "Page", "page"),
                    parseStringField(map, "Ext", "ext"),
                    parseStringField(map, "Caption", "caption"),
                    parseStringField(map, "ImageData", "image_data"),
                    parseStringField(map, "Url", "url"),
                    parseStringField(map, "SourceFile", "source_file")
            ));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<AiChatReferenceDto> parseReferences(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return List.of();
        }
        Object raw = response.get("Reference");
        if (!(raw instanceof List<?>)) {
            raw = response.get("reference");
        }
        if (!(raw instanceof List<?> items)) {
            return List.of();
        }
        List<AiChatReferenceDto> out = new ArrayList<>();
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> rawMap)) {
                continue;
            }
            Map<String, Object> map = rawMap.entrySet().stream()
                    .filter(e -> e.getKey() != null)
                    .collect(Collectors.toMap(
                            e -> String.valueOf(e.getKey()),
                            Map.Entry::getValue,
                            (a, b) -> b,
                            LinkedHashMap::new
                    ));
            String book = parseStringField(map, "BookName", "book_name");
            int page = parseIntField(map, "Page", "page");
            if (book.isBlank()) {
                continue;
            }
            out.add(new AiChatReferenceDto(book, page));
        }
        return out;
    }

    private static int parseIntField(Map<String, Object> response, String... keys) {
        Integer v = parseIntegerField(response, keys);
        return v == null ? 0 : v;
    }

    private static String parseStringField(Map<String, Object> response, String... keys) {
        if (response == null || keys == null) {
            return "";
        }
        for (String key : keys) {
            Object raw = response.get(key);
            String value = String.valueOf(raw == null ? "" : raw).trim();
            if (!value.isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private static Integer parseIntegerField(Map<String, Object> response, String... keys) {
        if (response == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            Object raw = response.get(key);
            if (raw == null) {
                continue;
            }
            try {
                return Integer.parseInt(String.valueOf(raw).trim());
            } catch (NumberFormatException ignored) {
                // continue
            }
        }
        return null;
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
