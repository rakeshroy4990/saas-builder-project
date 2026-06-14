package com.flexshell.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.GrowthHistorySummaryRequest;
import com.flexshell.controller.dto.GrowthHistorySummaryResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

@Component
public class PdfRagGrowthAdapter {
    private static final Logger LOG = LoggerFactory.getLogger(PdfRagGrowthAdapter.class);

    private final boolean enabled;
    private final String baseUrl;
    private final String growthSummaryPath;
    private final String growthSummaryStreamPath;
    private final int timeoutSeconds;
    private final ObjectMapper objectMapper;
    private final HttpClient streamingHttpClient;

    public PdfRagGrowthAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.growth-summary-path:/api/v1/growth/history/summarize}") String growthSummaryPath,
            @Value("${app.ai.rag.growth-summary-stream-path:}") String growthSummaryStreamPathOverride,
            @Value("${app.ai.rag.growth-summary-timeout-seconds:25}") int timeoutSeconds,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.growthSummaryPath = normalizeApiPath(
                growthSummaryPath == null ? "/api/v1/growth/history/summarize" : growthSummaryPath.trim()
        );
        String override = growthSummaryStreamPathOverride == null ? "" : growthSummaryStreamPathOverride.trim();
        this.growthSummaryStreamPath = override.isEmpty()
                ? this.growthSummaryPath + "/stream"
                : normalizeApiPath(override);
        this.timeoutSeconds = Math.max(5, timeoutSeconds);
        this.objectMapper = objectMapper;
        this.streamingHttpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public GrowthHistorySummaryResponse summarize(
            GrowthHistorySummaryRequest request,
            String authorizationHeader
    ) {
        long startMs = System.currentTimeMillis();
        if (!enabled || baseUrl.isBlank()) {
            LOG.info("growth_rag_fallback reason=not_configured elapsedMs={}", elapsedMs(startMs));
            return fallbackSummary(request);
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for growth summary");
        }

        Map<String, Object> body = buildRequestBody(request);
        URI uri = URI.create(joinBaseAndPath(baseUrl, growthSummaryPath));
        LOG.info("growth_rag_summarize_start uri={}", uri);

        RestClient client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(buildRestRequestFactory())
                .build();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(growthSummaryPath)
                    .headers(h -> h.set(HttpHeaders.AUTHORIZATION, authorizationHeader.trim()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            GrowthHistorySummaryResponse parsed = parseResponse(response);
            LOG.info(
                    "growth_rag_summarize_complete uri={} totalMs={} summaryLen={}",
                    uri,
                    elapsedMs(startMs),
                    parsed.getSummary() == null ? 0 : parsed.getSummary().length()
            );
            return parsed;
        } catch (RestClientResponseException ex) {
            LOG.warn(
                    "pdf_rag_growth_summary_failed status={} detail={} elapsedMs={}",
                    ex.getStatusCode().value(),
                    ex.getStatusText(),
                    elapsedMs(startMs)
            );
            return fallbackSummary(request);
        } catch (Exception ex) {
            LOG.warn("pdf_rag_growth_summary_failed message={} elapsedMs={}", ex.toString(), elapsedMs(startMs));
            return fallbackSummary(request);
        }
    }

    /**
     * Proxies pdf-rag {@code POST .../growth/history/summarize/stream} NDJSON lines to {@code onLine}.
     */
    public void streamSummarizeNdjson(
            GrowthHistorySummaryRequest request,
            String authorizationHeader,
            Consumer<String> onLine
    ) {
        long startMs = System.currentTimeMillis();
        if (!enabled || baseUrl.isBlank()) {
            LOG.info("growth_rag_stream_local_fallback reason=not_configured elapsedMs={}", elapsedMs(startMs));
            emitLocalFallbackStream(fallbackSummary(request), onLine);
            return;
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for growth summary");
        }

        final String json;
        try {
            json = objectMapper.writeValueAsString(buildRequestBody(request));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not build growth summary request JSON: " + ex.getMessage(), ex);
        }

        URI uri = URI.create(joinBaseAndPath(baseUrl, growthSummaryStreamPath));
        LOG.info("growth_rag_stream_start uri={}", uri);
        HttpRequest httpRequest = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(Math.max(timeoutSeconds, 60)))
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader.trim())
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();

        final HttpResponse<InputStream> resp;
        try {
            resp = streamingHttpClient.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Growth summary stream request was interrupted.", ex);
        } catch (IOException ex) {
            LOG.warn("pdf_rag_growth_stream_connect_failed uri={} message={}", uri, ex.toString());
            emitLocalFallbackStream(fallbackSummary(request), onLine);
            return;
        }

        int code = resp.statusCode();
        if (code != 200) {
            LOG.warn("pdf_rag_growth_stream_failed status={}", code);
            emitLocalFallbackStream(fallbackSummary(request), onLine);
            return;
        }

        try (InputStream raw = resp.body();
             BufferedReader br = new BufferedReader(new InputStreamReader(raw, StandardCharsets.UTF_8))) {
            boolean sawTerminal = false;
            int lineCount = 0;
            String line;
            while ((line = br.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                lineCount++;
                if (isTerminalNdjsonLine(line)) {
                    sawTerminal = true;
                }
                onLine.accept(line);
            }
            LOG.info(
                    "growth_rag_stream_complete uri={} totalMs={} lineCount={} terminal={}",
                    uri,
                    elapsedMs(startMs),
                    lineCount,
                    sawTerminal
            );
            if (!sawTerminal) {
                emitLocalCompleteLine(fallbackSummary(request), onLine);
            }
        } catch (IOException ex) {
            LOG.warn("pdf_rag_growth_stream_read_failed uri={} message={} elapsedMs={}", uri, ex.toString(), elapsedMs(startMs));
            emitLocalFallbackStream(fallbackSummary(request), onLine);
        }
    }

    private boolean isTerminalNdjsonLine(String line) {
        try {
            com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(line);
            String type = root.path("type").asText("").trim().toLowerCase(Locale.ROOT);
            return "complete".equals(type) || "error".equals(type);
        } catch (Exception ex) {
            return false;
        }
    }

    private void emitLocalCompleteLine(GrowthHistorySummaryResponse fallback, Consumer<String> onLine) {
        try {
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "complete", "data", buildCompletePayload(fallback))));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not emit local growth complete line", ex);
        }
    }

    private void emitLocalFallbackStream(GrowthHistorySummaryResponse fallback, Consumer<String> onLine) {
        try {
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "ready", "data", Map.of())));
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "status", "data", Map.of("phase", "generating"))));
            String summary = Objects.toString(fallback.getSummary(), "");
            int step = 24;
            for (int i = 0; i < summary.length(); i += step) {
                String chunk = summary.substring(i, Math.min(i + step, summary.length()));
                onLine.accept(objectMapper.writeValueAsString(Map.of("type", "delta", "text", chunk)));
            }
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "complete", "data", buildCompletePayload(fallback))));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not emit local growth fallback stream", ex);
        }
    }

    private Map<String, Object> buildCompletePayload(GrowthHistorySummaryResponse response) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("Summary", response.getSummary());
        payload.put("ModelUsed", response.getModelUsed());
        payload.put("ReplyLocale", response.getReplyLocale());
        if (response.getCharacteristics() != null) {
            Map<String, Object> characteristics = new LinkedHashMap<>();
            characteristics.put("Phrase", response.getCharacteristics().getPhrase());
            characteristics.put("Labels", response.getCharacteristics().getLabels());
            characteristics.put("TraitCodes", response.getCharacteristics().getTraitCodes());
            payload.put("Characteristics", characteristics);
        }
        return payload;
    }

    private GrowthHistorySummaryResponse fallbackSummary(GrowthHistorySummaryRequest request) {
        GrowthHistorySummaryResponse response = new GrowthHistorySummaryResponse();
        int ageMonths = request.getAgeMonthsAtRecording() == null
                ? 0
                : request.getAgeMonthsAtRecording().intValue();
        StringBuilder text = new StringBuilder("At ").append(Math.max(0, ageMonths)).append(" months");
        if (request.getWeightKg() != null) {
            text.append(", weight ").append(stripTrailingZeros(request.getWeightKg())).append(" kg recorded");
        }
        if (request.getHeightCm() != null) {
            text.append(", height ").append(stripTrailingZeros(request.getHeightCm())).append(" cm recorded");
        }
        if (request.getHeadCircumferenceCm() != null) {
            text.append(", head circumference recorded");
        }
        text.append(" — track trends with your pediatrician.");
        response.setSummary(text.toString());
        response.setModelUsed("fallback");
        response.setReplyLocale(normalizeLocale(request.getReplyLocale()));
        return response;
    }

    private Map<String, Object> buildRequestBody(GrowthHistorySummaryRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (request.getAgeMonthsAtRecording() != null) {
            body.put("AgeMonthsAtRecording", request.getAgeMonthsAtRecording());
        }
        putIfPresent(body, "WeightKg", request.getWeightKg());
        putIfPresent(body, "HeightCm", request.getHeightCm());
        putIfPresent(body, "HeadCircumferenceCm", request.getHeadCircumferenceCm());
        putIfPresent(body, "WeightPercentile", request.getWeightPercentile());
        putIfPresent(body, "HeightPercentile", request.getHeightPercentile());
        putIfPresent(body, "BmiPercentile", request.getBmiPercentile());
        putIfPresent(body, "HcPercentile", request.getHcPercentile());
        if (request.getSex() != null && !request.getSex().isBlank()) {
            body.put("Sex", request.getSex().trim().toLowerCase(Locale.ROOT));
        }
        String locale = normalizeLocale(request.getReplyLocale());
        if (!locale.isBlank()) {
            body.put("ReplyLocale", locale);
        }
        return body;
    }

    private static void putIfPresent(Map<String, Object> body, String key, BigDecimal value) {
        if (value != null) {
            body.put(key, value);
        }
    }

    private GrowthHistorySummaryResponse parseResponse(Map<String, Object> response) {
        GrowthHistorySummaryResponse out = new GrowthHistorySummaryResponse();
        if (response == null) {
            out.setSummary("");
            out.setModelUsed("");
            out.setReplyLocale("en");
            return out;
        }
        out.setSummary(Objects.toString(response.get("Summary"), "").trim());
        out.setModelUsed(Objects.toString(response.get("ModelUsed"), "").trim());
        out.setReplyLocale(normalizeLocale(Objects.toString(response.get("ReplyLocale"), "en")));
        return out;
    }

    private static String normalizeLocale(String locale) {
        String raw = Objects.toString(locale, "en").trim().toLowerCase();
        if (raw.isBlank()) {
            return "en";
        }
        int dash = raw.indexOf('-');
        return dash > 0 ? raw.substring(0, dash) : raw;
    }

    private static String stripTrailingZeros(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private SimpleClientHttpRequestFactory buildRestRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return factory;
    }

    private static String normalizeApiPath(String path) {
        return path.startsWith("/") ? path : "/" + path;
    }

    private static String joinBaseAndPath(String base, String path) {
        String b = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        String p = path.startsWith("/") ? path : "/" + path;
        return b + p;
    }

    private static long elapsedMs(long startMs) {
        return System.currentTimeMillis() - startMs;
    }
}
