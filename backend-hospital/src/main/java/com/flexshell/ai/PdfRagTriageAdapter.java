package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.math.BigDecimal;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Component
public class PdfRagTriageAdapter {
    private static final Logger LOG = LoggerFactory.getLogger(PdfRagTriageAdapter.class);

    private final boolean enabled;
    private final String baseUrl;
    private final String triagePath;
    private final String triageStreamPath;
    private final int timeoutSeconds;
    private final ObjectMapper objectMapper;
    private final HttpClient streamingHttpClient;

    public PdfRagTriageAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.triage-path:/api/v1/triage/analyze}") String triagePath,
            @Value("${app.ai.rag.triage-stream-path:}") String triageStreamPathOverride,
            @Value("${app.ai.rag.triage-timeout-seconds:30}") int timeoutSeconds,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.triagePath = normalizeApiPath(triagePath == null ? "/api/v1/triage/analyze" : triagePath.trim());
        String override = triageStreamPathOverride == null ? "" : triageStreamPathOverride.trim();
        this.triageStreamPath = override.isEmpty() ? this.triagePath + "/stream" : normalizeApiPath(override);
        this.timeoutSeconds = Math.max(5, timeoutSeconds);
        this.objectMapper = objectMapper;
        this.streamingHttpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public TriageAnalysisResult analyze(
            int childAgeMonths,
            BigDecimal childWeightKg,
            List<String> reportedSymptoms,
            Integer symptomDurationHours,
            String symptomSeverity,
            String additionalNotes,
            String authorizationHeader
    ) {
        long startMs = System.currentTimeMillis();
        if (!enabled || baseUrl.isBlank()) {
            LOG.info("triage_rag_sync_fallback_local reason=not_configured elapsedMs={}", elapsedMs(startMs));
            return fallbackClinicVisit("Triage service is not configured.");
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for triage analysis");
        }

        Map<String, Object> body = buildRequestBody(
                childAgeMonths,
                childWeightKg,
                reportedSymptoms,
                symptomDurationHours,
                symptomSeverity,
                additionalNotes
        );

        URI uri = URI.create(joinBaseAndPath(baseUrl, triagePath));
        LOG.info("triage_rag_sync_start uri={} symptomCount={}", uri, reportedSymptoms == null ? 0 : reportedSymptoms.size());

        RestClient client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(buildRestRequestFactory())
                .build();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(triagePath)
                    .headers(h -> h.set(HttpHeaders.AUTHORIZATION, authorizationHeader.trim()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            TriageAnalysisResult parsed = parseResponse(response);
            LOG.info(
                    "triage_rag_sync_complete uri={} totalMs={} urgency={} model={}",
                    uri,
                    elapsedMs(startMs),
                    parsed.urgencyLevel(),
                    parsed.modelUsed()
            );
            return parsed;
        } catch (RestClientResponseException ex) {
            LOG.warn(
                    "pdf_rag_triage_failed status={} detail={} elapsedMs={}",
                    ex.getStatusCode().value(),
                    ex.getStatusText(),
                    elapsedMs(startMs)
            );
            return fallbackClinicVisit("Triage analysis is temporarily unavailable. Please consult a pediatrician.");
        } catch (Exception ex) {
            LOG.warn("pdf_rag_triage_failed message={} elapsedMs={}", ex.toString(), elapsedMs(startMs));
            return fallbackClinicVisit("Triage analysis is temporarily unavailable. Please consult a pediatrician.");
        }
    }

    /**
     * Calls pdf-rag {@code POST .../triage/analyze/stream} and invokes {@code onLine} for each NDJSON line.
     */
    public void streamAnalyzeNdjson(
            int childAgeMonths,
            BigDecimal childWeightKg,
            List<String> reportedSymptoms,
            Integer symptomDurationHours,
            String symptomSeverity,
            String additionalNotes,
            String authorizationHeader,
            Consumer<String> onLine
    ) {
        long startMs = System.currentTimeMillis();
        if (!enabled || baseUrl.isBlank()) {
            LOG.info("triage_rag_stream_local_fallback reason=not_configured elapsedMs={}", elapsedMs(startMs));
            emitLocalFallbackStream(fallbackClinicVisit("Triage service is not configured."), onLine);
            return;
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for triage analysis");
        }

        Map<String, Object> body = buildRequestBody(
                childAgeMonths,
                childWeightKg,
                reportedSymptoms,
                symptomDurationHours,
                symptomSeverity,
                additionalNotes
        );
        final String json;
        try {
            json = objectMapper.writeValueAsString(body);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not build triage request JSON: " + ex.getMessage(), ex);
        }

        URI uri = URI.create(joinBaseAndPath(baseUrl, triageStreamPath));
        LOG.info("triage_rag_stream_start uri={} symptomCount={}", uri, reportedSymptoms == null ? 0 : reportedSymptoms.size());
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(Math.max(timeoutSeconds, 120)))
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader.trim())
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();

        final HttpResponse<InputStream> resp;
        long connectStartMs = System.currentTimeMillis();
        try {
            resp = streamingHttpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            LOG.info("triage_rag_stream_connected uri={} connectMs={} status={}", uri, elapsedMs(connectStartMs), resp.statusCode());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Triage stream request was interrupted.", ex);
        } catch (IOException ex) {
            LOG.warn(
                    "pdf_rag_triage_stream_connect_failed uri={} connectMs={} message={}",
                    uri,
                    elapsedMs(connectStartMs),
                    ex.toString()
            );
            emitLocalFallbackStream(
                    fallbackClinicVisit("Triage analysis is temporarily unavailable. Please consult a pediatrician."),
                    onLine
            );
            LOG.info("triage_rag_stream_local_fallback reason=connect_failed totalMs={}", elapsedMs(startMs));
            return;
        }

        int code = resp.statusCode();
        if (code != 200) {
            String errBody = "";
            try (InputStream in = resp.body()) {
                errBody = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException ex) {
                LOG.warn("pdf_rag_triage_stream_error_body_read_failed uri={} status={}", uri, code);
            }
            LOG.warn(
                    "pdf_rag_triage_stream_failed status={} connectMs={} body={}",
                    code,
                    elapsedMs(connectStartMs),
                    errBody
            );
            emitLocalFallbackStream(
                    fallbackClinicVisit("Triage analysis is temporarily unavailable. Please consult a pediatrician."),
                    onLine
            );
            LOG.info("triage_rag_stream_local_fallback reason=http_{} totalMs={}", code, elapsedMs(startMs));
            return;
        }

        try (InputStream raw = resp.body();
             BufferedReader br = new BufferedReader(new InputStreamReader(raw, StandardCharsets.UTF_8))) {
            boolean sawTerminal = false;
            boolean loggedFirstLine = false;
            int lineCount = 0;
            String line;
            while ((line = br.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                lineCount++;
                if (!loggedFirstLine) {
                    loggedFirstLine = true;
                    LOG.info("triage_rag_stream_first_line uri={} firstLineMs={}", uri, elapsedMs(startMs));
                }
                if (isTerminalNdjsonLine(line)) {
                    sawTerminal = true;
                }
                onLine.accept(line);
            }
            LOG.info(
                    "triage_rag_stream_finished uri={} totalMs={} lineCount={} sawTerminal={}",
                    uri,
                    elapsedMs(startMs),
                    lineCount,
                    sawTerminal
            );
            if (!sawTerminal) {
                LOG.warn("pdf_rag_triage_stream_missing_terminal uri={} totalMs={}", uri, elapsedMs(startMs));
                emitLocalCompleteLine(
                        fallbackClinicVisit("Triage analysis is temporarily unavailable. Please consult a pediatrician."),
                        onLine
                );
            }
        } catch (IOException ex) {
            LOG.warn("pdf_rag_triage_stream_read_failed uri={} totalMs={} message={}", uri, elapsedMs(startMs), ex.toString());
            throw new IllegalStateException("Triage stream read failed: " + ex.getMessage(), ex);
        }
    }

    public TriageAnalysisResult parseResponseMap(Map<String, Object> response) {
        return parseResponse(response);
    }

    private boolean isTerminalNdjsonLine(String line) {
        try {
            JsonNode root = objectMapper.readTree(line);
            String type = root.path("type").asText("").trim().toLowerCase(Locale.ROOT);
            return "complete".equals(type) || "error".equals(type);
        } catch (Exception ex) {
            return false;
        }
    }

    private void emitLocalCompleteLine(TriageAnalysisResult fallback, Consumer<String> onLine) {
        try {
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "complete", "data", buildCompletePayload(fallback))));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not emit local triage complete line", ex);
        }
    }

    private void emitLocalFallbackStream(TriageAnalysisResult fallback, Consumer<String> onLine) {
        try {
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "ready", "data", Map.of())));
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "status", "data", Map.of("phase", "generating"))));
            String reasoning = fallback.urgencyReasoning();
            int step = 80;
            for (int i = 0; i < reasoning.length(); i += step) {
                String chunk = reasoning.substring(i, Math.min(i + step, reasoning.length()));
                onLine.accept(objectMapper.writeValueAsString(Map.of("type", "delta", "text", chunk)));
            }
            onLine.accept(objectMapper.writeValueAsString(Map.of("type", "complete", "data", buildCompletePayload(fallback))));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not emit local triage fallback stream", ex);
        }
    }

    private Map<String, Object> buildCompletePayload(TriageAnalysisResult fallback) {
        Map<String, Object> complete = new LinkedHashMap<>();
        complete.put("UrgencyLevel", fallback.urgencyLevel());
        complete.put("UrgencyReasoning", fallback.urgencyReasoning());
        complete.put("DoctorNote", fallback.doctorNote());
        complete.put("RedFlags", fallback.redFlags());
        complete.put("Confidence", fallback.confidence());
        complete.put("ModelUsed", fallback.modelUsed());
        complete.put("RagChunksUsed", fallback.ragChunksUsed());
        return complete;
    }

    private static Map<String, Object> buildRequestBody(
            int childAgeMonths,
            BigDecimal childWeightKg,
            List<String> reportedSymptoms,
            Integer symptomDurationHours,
            String symptomSeverity,
            String additionalNotes
    ) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ChildAgeMonths", childAgeMonths);
        if (childWeightKg != null) {
            body.put("ChildWeightKg", childWeightKg);
        }
        body.put("ReportedSymptoms", reportedSymptoms == null ? List.of() : reportedSymptoms);
        if (symptomDurationHours != null) {
            body.put("SymptomDurationHours", symptomDurationHours);
        }
        body.put("SymptomSeverity", symptomSeverity);
        if (additionalNotes != null && !additionalNotes.isBlank()) {
            body.put("AdditionalNotes", additionalNotes.trim());
        }
        return body;
    }

    public static TriageAnalysisResult fallbackClinicVisit(String reasoning) {
        return new TriageAnalysisResult(
                "CLINIC_VISIT",
                reasoning,
                "Automated triage fallback — clinician review recommended.",
                List.of(),
                "LOW",
                "fallback",
                List.of()
        );
    }

    @SuppressWarnings("unchecked")
    private TriageAnalysisResult parseResponse(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return fallbackClinicVisit("Triage response was empty.");
        }
        String urgency = pickString(response, "UrgencyLevel", "urgency_level");
        String reasoning = pickString(response, "UrgencyReasoning", "urgency_reasoning");
        String doctorNote = pickString(response, "DoctorNote", "doctor_note");
        String confidence = pickString(response, "Confidence", "confidence");
        String modelUsed = pickString(response, "ModelUsed", "model_used");
        List<String> redFlags = parseStringList(response.get("RedFlags"), response.get("red_flags"));
        List<Map<String, Object>> ragChunks = parseRagChunks(response.get("RagChunksUsed"), response.get("rag_chunks_used"));
        if (urgency.isBlank()) {
            urgency = "CLINIC_VISIT";
        }
        if (reasoning.isBlank()) {
            reasoning = "Please consult your pediatrician for further guidance.";
        }
        if (doctorNote.isBlank()) {
            doctorNote = "Pre-consultation triage completed.";
        }
        if (confidence.isBlank()) {
            confidence = "LOW";
        }
        if (modelUsed.isBlank()) {
            modelUsed = "gpt-4o-mini";
        }
        return new TriageAnalysisResult(urgency, reasoning, doctorNote, redFlags, confidence, modelUsed, ragChunks);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> parseRagChunks(Object primary, Object secondary) {
        Object raw = primary instanceof List<?> ? primary : secondary;
        if (!(raw instanceof List<?> items)) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
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
            out.add(map);
        }
        return out;
    }

    private static List<String> parseStringList(Object primary, Object secondary) {
        Object raw = primary instanceof List<?> ? primary : secondary;
        if (!(raw instanceof List<?> items)) {
            return List.of();
        }
        return items.stream()
                .map(value -> String.valueOf(value == null ? "" : value).trim())
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private static String pickString(Map<String, Object> response, String... keys) {
        for (String key : keys) {
            Object raw = response.get(key);
            String value = String.valueOf(raw == null ? "" : raw).trim();
            if (!value.isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private SimpleClientHttpRequestFactory buildRestRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(Math.max(timeoutSeconds, 120)));
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

    public record TriageAnalysisResult(
            String urgencyLevel,
            String urgencyReasoning,
            String doctorNote,
            List<String> redFlags,
            String confidence,
            String modelUsed,
            List<Map<String, Object>> ragChunksUsed
    ) {
    }
}
