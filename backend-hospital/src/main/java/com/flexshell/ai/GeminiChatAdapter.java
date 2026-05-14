package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AiChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class GeminiChatAdapter {
    private static final Logger LOG = LoggerFactory.getLogger(GeminiChatAdapter.class);
    private final ObjectMapper objectMapper;
    private final AiSafetyPolicy aiSafetyPolicy;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final String pathTemplate;
    private final int maxTokens;
    private final double temperature;
    private final int timeoutMs;
    private final int visionTimeoutMs;
    private final int prescriptionVisionMaxOutputTokens;
    private final int prescriptionVisionHttpRetries;

    public GeminiChatAdapter(
            ObjectMapper objectMapper,
            AiSafetyPolicy aiSafetyPolicy,
            @Value("${app.ai.gemini.api-key:}") String apiKey,
            @Value("${app.ai.gemini.model:gemini-1.5-flash}") String model,
            @Value("${app.ai.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${app.ai.gemini.chat-path-template:/v1beta/models/%s:generateContent}") String pathTemplate,
            @Value("${app.ai.max-tokens:400}") int maxTokens,
            @Value("${app.ai.temperature:0.3}") double temperature,
            @Value("${app.ai.timeout-ms:12000}") int timeoutMs,
            @Value("${app.ai.prescription-vision-timeout-ms:90000}") int visionTimeoutMs,
            @Value("${app.ai.prescription-vision-max-output-tokens:2048}") int prescriptionVisionMaxOutputTokens,
            @Value("${app.ai.prescription-vision-http-retries:2}") int prescriptionVisionHttpRetries
    ) {
        this.objectMapper = objectMapper;
        this.aiSafetyPolicy = aiSafetyPolicy;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(Math.max(timeoutMs, 2000))).build();
        this.apiKey = Objects.toString(apiKey, "").trim();
        this.model = Objects.toString(model, "gemini-1.5-flash").trim();
        this.baseUrl = Objects.toString(baseUrl, "https://generativelanguage.googleapis.com").trim();
        this.pathTemplate = Objects.toString(pathTemplate, "/v1beta/models/%s:generateContent").trim();
        this.maxTokens = Math.max(maxTokens, 64);
        this.temperature = temperature;
        this.timeoutMs = Math.max(timeoutMs, 2000);
        this.visionTimeoutMs = Math.max(visionTimeoutMs, 15_000);
        this.prescriptionVisionMaxOutputTokens = Math.min(8192, Math.max(256, prescriptionVisionMaxOutputTokens));
        this.prescriptionVisionHttpRetries = Math.min(5, Math.max(0, prescriptionVisionHttpRetries));
    }

    /**
     * Multimodal transcription: raw base64 image bytes (no data-URL prefix), MIME e.g. image/png.
     */
    public String transcribePrescriptionFromInlineImage(String mimeType, String base64Image) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "Gemini API key is not configured for prescription transcription."
            );
        }
        String mime = Objects.toString(mimeType, "application/octet-stream").trim().toLowerCase();
        String b64 = Objects.toString(base64Image, "").trim().replace("\n", "").replace("\r", "");
        if (b64.isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, "Empty image payload.");
        }
        try {
            String path = String.format(pathTemplate, model);
            String url = joinUrl(baseUrl, path) + "?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

            Map<String, Object> inline = new LinkedHashMap<>();
            inline.put("mime_type", mime.isBlank() ? "image/png" : mime);
            inline.put("data", b64);

            List<Map<String, Object>> parts = new ArrayList<>();
            parts.add(Map.of("text", PrescriptionVisionPrompts.VISION_JSON_USER.trim()));
            parts.add(Map.of("inline_data", inline));

            List<Map<String, Object>> contents = List.of(Map.of(
                    "role", "user",
                    "parts", parts
            ));

            Map<String, Object> payload = new HashMap<>();
            payload.put("systemInstruction", Map.of("parts", List.of(Map.of("text", PrescriptionVisionPrompts.VISION_JSON_SYSTEM.trim()))));
            payload.put("contents", contents);
            payload.put("generationConfig", Map.of(
                    "temperature", 0.1,
                    "maxOutputTokens", prescriptionVisionMaxOutputTokens
            ));

            String requestBody = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(visionTimeoutMs))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            int maxAttempts = 1 + prescriptionVisionHttpRetries;
            for (int attempt = 0; attempt < maxAttempts; attempt++) {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int code = response.statusCode();
                String body = response.body();
                if (code >= 200 && code < 300) {
                    return parseResponseText(body).trim();
                }
                if (attempt < maxAttempts - 1 && AiProviderHttpRetry.shouldRetryAfterHttpFailure(code, body)) {
                    LOG.warn(
                            "gemini_prescription_vision_http_retry attempt={} maxAttempts={} httpStatus={}",
                            attempt + 1,
                            maxAttempts,
                            code);
                    try {
                        AiProviderHttpRetry.sleepBeforeRetry(attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new AiProviderException(
                                AiProviderException.Kind.PROVIDER_FAILED,
                                "Smart AI provider is temporarily unavailable."
                        );
                    }
                    continue;
                }
                throw geminiVisionTranscriptionException(code, body);
            }
            throw geminiVisionTranscriptionException(0, "");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        } catch (IOException ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        }
    }

    private AiProviderException geminiVisionTranscriptionException(int statusCode, String body) {
        String providerStatus = "";
        String providerMessage = "Gemini vision transcription failed.";
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode errorNode = root.path("error");
            providerStatus = errorNode.path("status").asText("");
            String upstreamMessage = errorNode.path("message").asText("");
            if (!upstreamMessage.isBlank()) {
                providerMessage = "Gemini provider error: " + upstreamMessage;
            }
        } catch (Exception ignored) {
            // keep generic provider message
        }
        return new AiProviderException(
                AiProviderException.Kind.PROVIDER_FAILED,
                providerMessage,
                "gemini",
                statusCode,
                providerStatus
        );
    }

    /**
     * Collapses noisy PDF/OCR text into the same {@code {"diagnosis","medications"}} JSON string as vision.
     */
    public String extractPrescriptionDiagnosisMedicationsJsonFromPlainText(String rawText) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "Gemini API key is not configured for prescription structuring."
            );
        }
        String raw = Objects.toString(rawText, "").trim();
        if (raw.isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, "Empty document text.");
        }
        String excerpt = raw.length() > 14_000 ? raw.substring(0, 14_000) : raw;
        try {
            String path = String.format(pathTemplate, model);
            String url = joinUrl(baseUrl, path) + "?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);

            List<Map<String, Object>> parts = List.of(
                    Map.of("text", PrescriptionVisionPrompts.TEXT_JSON_USER_PREFIX + excerpt)
            );
            List<Map<String, Object>> contents = List.of(Map.of(
                    "role", "user",
                    "parts", parts
            ));

            Map<String, Object> payload = new HashMap<>();
            payload.put("systemInstruction", Map.of("parts", List.of(Map.of("text", PrescriptionVisionPrompts.TEXT_JSON_SYSTEM.trim()))));
            payload.put("contents", contents);
            payload.put("generationConfig", Map.of(
                    "temperature", 0.1,
                    "maxOutputTokens", 900
            ));

            String requestBody = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(Math.max(timeoutMs, 30_000)))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "Gemini prescription structuring failed.",
                        "gemini",
                        response.statusCode(),
                        ""
                );
            }
            return parseResponseText(response.body()).trim();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        } catch (IOException ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        }
    }

    public String complete(List<AiChatMessageDto> history, String message) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "Smart AI is not configured on this environment."
            );
        }
        try {
            String path = String.format(pathTemplate, model);
            String url = joinUrl(baseUrl, path) + "?key=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
            String requestBody = buildRequestBody(history, message);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String providerStatus = "";
                String providerMessage = "Smart AI provider is temporarily unavailable.";
                try {
                    JsonNode root = objectMapper.readTree(response.body());
                    JsonNode errorNode = root.path("error");
                    providerStatus = errorNode.path("status").asText("");
                    String upstreamMessage = errorNode.path("message").asText("");
                    if (!upstreamMessage.isBlank()) {
                        providerMessage = "Gemini provider error: " + upstreamMessage;
                    }
                } catch (Exception ignored) {
                    // keep generic provider message
                }
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        providerMessage,
                        "gemini",
                        response.statusCode(),
                        providerStatus
                );
            }
            return parseResponseText(response.body());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        } catch (IOException ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        }
    }

    private String buildRequestBody(List<AiChatMessageDto> history, String message) throws IOException {
        List<Map<String, Object>> contents = new ArrayList<>();
        if (history != null) {
            for (AiChatMessageDto item : history) {
                if (item == null) continue;
                String role = Objects.toString(item.role(), "").trim().toLowerCase();
                String content = Objects.toString(item.content(), "").trim();
                if (content.isBlank()) continue;
                if (!"assistant".equals(role) && !"user".equals(role)) continue;
                contents.add(Map.of(
                        "role", "assistant".equals(role) ? "model" : "user",
                        "parts", List.of(Map.of("text", content))
                ));
            }
        }
        String latest = Objects.toString(message, "").trim();
        if (!latest.isBlank()) {
            contents.add(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", latest))
            ));
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("systemInstruction", Map.of("parts", List.of(Map.of("text", aiSafetyPolicy.systemPrompt()))));
        payload.put("contents", contents);
        payload.put("generationConfig", Map.of(
                "temperature", temperature,
                "maxOutputTokens", maxTokens
        ));
        return objectMapper.writeValueAsString(payload);
    }

    private String parseResponseText(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            return "";
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode part : parts) {
            if (part == null || part.isNull()) {
                continue;
            }
            String t = part.path("text").asText("");
            if (t.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append(t);
        }
        return sb.toString();
    }

    private static String joinUrl(String base, String path) {
        if (base.endsWith("/") && path.startsWith("/")) return base + path.substring(1);
        if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
        return base + path;
    }
}
