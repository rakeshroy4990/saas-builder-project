package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AiChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Component
public class OpenAiChatAdapter {
    private static final Logger LOG = LoggerFactory.getLogger(OpenAiChatAdapter.class);
    private final ObjectMapper objectMapper;
    private final AiSafetyPolicy aiSafetyPolicy;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final String chatPath;
    private final int maxTokens;
    private final double temperature;
    private final int timeoutMs;
    private final int blogMaxTokens;
    private final double blogTemperature;
    private final int visionTimeoutMs;
    /** OpenAI vision {@code image_url.detail}: {@code low} (faster, smaller tiles), {@code high}, or {@code auto} (omit). */
    private final String prescriptionVisionOpenAiImageDetail;
    private final int prescriptionVisionMaxOutputTokens;
    private final int prescriptionVisionHttpRetries;

    public OpenAiChatAdapter(
            ObjectMapper objectMapper,
            AiSafetyPolicy aiSafetyPolicy,
            @Value("${app.ai.openai.api-key:}") String apiKey,
            @Value("${app.ai.openai.model:gpt-4o-mini}") String model,
            @Value("${app.ai.openai.base-url:https://api.openai.com}") String baseUrl,
            @Value("${app.ai.openai.chat-path:/v1/chat/completions}") String chatPath,
            @Value("${app.ai.max-tokens:400}") int maxTokens,
            @Value("${app.ai.temperature:0.3}") double temperature,
            @Value("${app.ai.timeout-ms:12000}") int timeoutMs,
            @Value("${app.ai.blog.max-tokens:4500}") int blogMaxTokens,
            @Value("${app.ai.blog.temperature:0.75}") double blogTemperature,
            @Value("${app.ai.prescription-vision-timeout-ms:90000}") int visionTimeoutMs,
            @Value("${app.ai.prescription-vision-openai-image-detail:low}") String prescriptionVisionOpenAiImageDetail,
            @Value("${app.ai.prescription-vision-max-output-tokens:2048}") int prescriptionVisionMaxOutputTokens,
            @Value("${app.ai.prescription-vision-http-retries:2}") int prescriptionVisionHttpRetries
    ) {
        this.objectMapper = objectMapper;
        this.aiSafetyPolicy = aiSafetyPolicy;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(Math.max(timeoutMs, 2000))).build();
        this.apiKey = Objects.toString(apiKey, "").trim();
        this.model = Objects.toString(model, "gpt-4o-mini").trim();
        this.baseUrl = Objects.toString(baseUrl, "https://api.openai.com").trim();
        this.chatPath = Objects.toString(chatPath, "/v1/chat/completions").trim();
        this.maxTokens = Math.max(maxTokens, 64);
        this.temperature = temperature;
        this.timeoutMs = Math.max(timeoutMs, 2000);
        this.blogMaxTokens = Math.max(blogMaxTokens, 256);
        this.blogTemperature = blogTemperature;
        this.visionTimeoutMs = Math.max(visionTimeoutMs, 15_000);
        this.prescriptionVisionOpenAiImageDetail =
                Objects.toString(prescriptionVisionOpenAiImageDetail, "low").trim().toLowerCase(Locale.ROOT);
        this.prescriptionVisionMaxOutputTokens = Math.min(4096, Math.max(256, prescriptionVisionMaxOutputTokens));
        this.prescriptionVisionHttpRetries = Math.min(5, Math.max(0, prescriptionVisionHttpRetries));
    }

    @PostConstruct
    void logPrescriptionVisionConfig() {
        LOG.info(
                "openai_prescription_vision_config model={} imageDetail={} visionTimeoutMs={} maxOutputTokens={} httpRetries={} maxAttempts={}",
                model,
                prescriptionVisionOpenAiImageDetail,
                visionTimeoutMs,
                prescriptionVisionMaxOutputTokens,
                prescriptionVisionHttpRetries,
                1 + prescriptionVisionHttpRetries
        );
    }

    /**
     * Vision transcription for prescription-style images (data URL, e.g. {@code data:image/png;base64,...}).
     */
    public String transcribePrescriptionFromImageDataUrl(String dataUrl) {
        return visionJsonFromImageDataUrl(
                dataUrl,
                PrescriptionVisionPrompts.VISION_JSON_SYSTEM.trim(),
                PrescriptionVisionPrompts.VISION_JSON_USER,
                prescriptionVisionMaxOutputTokens
        );
    }

    /** Second-pass vitals-only vision read when full transcription omits Wt/Temp. */
    public String extractPrescriptionVitalsFromImageDataUrl(String dataUrl) {
        return visionJsonFromImageDataUrl(
                dataUrl,
                PrescriptionVitalsVisionPrompts.VISION_JSON_SYSTEM.trim(),
                PrescriptionVitalsVisionPrompts.VISION_JSON_USER,
                Math.min(512, prescriptionVisionMaxOutputTokens)
        );
    }

    private String visionJsonFromImageDataUrl(
            String dataUrl,
            String systemPrompt,
            String userPrompt,
            int maxOutputTokens
    ) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "OpenAI API key is not configured for prescription transcription."
            );
        }
        String url = Objects.toString(dataUrl, "").trim();
        if (url.isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, "Empty image payload.");
        }
        try {
            List<Map<String, Object>> userParts = new ArrayList<>();
            userParts.add(Map.of("type", "text", "text", userPrompt));
            Map<String, Object> imageUrl = new LinkedHashMap<>();
            imageUrl.put("url", url);
            if ("low".equals(prescriptionVisionOpenAiImageDetail)
                    || "high".equals(prescriptionVisionOpenAiImageDetail)
                    || "auto".equals(prescriptionVisionOpenAiImageDetail)) {
                imageUrl.put("detail", prescriptionVisionOpenAiImageDetail);
            }
            Map<String, Object> imagePart = new LinkedHashMap<>();
            imagePart.put("type", "image_url");
            imagePart.put("image_url", imageUrl);
            userParts.add(imagePart);

            List<Map<String, Object>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            messages.add(Map.of("role", "user", "content", userParts));

            Map<String, Object> payload = new HashMap<>();
            payload.put("model", model);
            payload.put("messages", messages);
            payload.put("max_tokens", maxOutputTokens);
            payload.put("temperature", 0.1);
            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, chatPath)))
                    .timeout(Duration.ofMillis(visionTimeoutMs))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            int maxAttempts = 1 + prescriptionVisionHttpRetries;
            LOG.info(
                    "openai_prescription_vision_request_start detail={} visionTimeoutMs={} maxAttempts={} payloadChars={}",
                    prescriptionVisionOpenAiImageDetail,
                    visionTimeoutMs,
                    maxAttempts,
                    requestBody.length()
            );
            long visionStartNanos = System.nanoTime();
            for (int attempt = 0; attempt < maxAttempts; attempt++) {
                if (attempt > 0) {
                    LOG.warn("openai_prescription_vision_retry attempt={} maxAttempts={}", attempt + 1, maxAttempts);
                }
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int code = response.statusCode();
                String body = response.body();
                if (code >= 200 && code < 300) {
                    long visionMs = Math.max(0L, (System.nanoTime() - visionStartNanos) / 1_000_000L);
                    LOG.info("openai_prescription_vision_request_ok elapsedMs={} attempt={}", visionMs, attempt + 1);
                    return parseResponseText(body).trim();
                }
                if (attempt < maxAttempts - 1 && AiProviderHttpRetry.shouldRetryAfterHttpFailure(code, body)) {
                    LOG.warn(
                            "openai_prescription_vision_http_retry attempt={} maxAttempts={} httpStatus={}",
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
                throw openAiVisionTranscriptionException(code, body);
            }
            throw openAiVisionTranscriptionException(0, "");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            LOG.warn("openai_prescription_vision_interrupted");
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        } catch (IOException ex) {
            LOG.warn("openai_prescription_vision_io_failed errorType={}", ex.getClass().getSimpleName());
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Smart AI provider is temporarily unavailable."
            );
        }
    }

    private AiProviderException openAiVisionTranscriptionException(int statusCode, String body) {
        String detail = parseOpenAiErrorMessage(body);
        String msg = detail.isBlank()
                ? "OpenAI vision transcription failed."
                : "OpenAI vision transcription failed: " + detail;
        return new AiProviderException(
                AiProviderException.Kind.PROVIDER_FAILED,
                msg,
                "openai",
                statusCode,
                ""
        );
    }

    private String parseOpenAiErrorMessage(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            return root.path("error").path("message").asText("").trim();
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Collapses noisy PDF/OCR text into the same {@code {"diagnosis","medications"}} JSON string as vision.
     */
    public String extractPrescriptionDiagnosisMedicationsJsonFromPlainText(String rawText) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "OpenAI API key is not configured for prescription structuring."
            );
        }
        String raw = Objects.toString(rawText, "").trim();
        if (raw.isBlank()) {
            throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, "Empty document text.");
        }
        String excerpt = raw.length() > 14_000 ? raw.substring(0, 14_000) : raw;
        String userMsg = PrescriptionVisionPrompts.TEXT_JSON_USER_PREFIX + excerpt;
        try {
            String requestBody = buildRequestBody(
                    PrescriptionVisionPrompts.TEXT_JSON_SYSTEM.trim(),
                    List.of(),
                    userMsg,
                    900,
                    0.1
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, chatPath)))
                    .timeout(Duration.ofMillis(Math.max(timeoutMs, 30_000)))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "OpenAI prescription structuring failed.",
                        "openai",
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

    /**
     * Generates blog teaser JSON using a non-triage system prompt (public marketing content only).
     */
    public String completeBlogPreviews(String userPrompt) {
        if (apiKey.isBlank()) {
            return "";
        }
        try {
            String requestBody = buildRequestBody(
                    BLOG_PREVIEW_SYSTEM_PROMPT, List.of(), userPrompt, blogMaxTokens, blogTemperature);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, chatPath)))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return "";
            }
            return parseResponseText(response.body());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return "";
        } catch (IOException ex) {
            return "";
        }
    }

    private static final String BLOG_PREVIEW_SYSTEM_PROMPT = """
            You are an editorial assistant for a hospital website's public wellness blog.
            Output ONLY a JSON array. No markdown fences, no commentary before or after.
            Each element must be an object with keys exactly:
            "title" (string, compelling question or headline),
            "slug" (string, lowercase kebab-case, URL-safe),
            "hook" (string, ONE inviting sentence for the blog grid, max ~160 characters; spark curiosity; no disclaimers),
            "curiosityQuestions" (JSON array of exactly 2 strings; each a genuine question ending with "?"; max ~120 chars each; must not repeat the hook verbatim; educational curiosity only),
            "teaser" (string, REQUIRED: full mini-article text for the dedicated article page only—not shown on the main grid.
            Use at least three paragraphs separated by a blank line (two newline characters between paragraphs).
            Each paragraph should have several sentences with concrete explanations, examples, or habits readers can try.
            Target about 120-200 words; educational tone; no diagnoses; no medication dosing; no emergency instructions;
            suitable for India/global English readers),
            "category" (string, short label e.g. Nutrition, Sleep, Heart Health),
            "readTimeMinutes" (integer, 6-14, consistent with reading time).
            Optional: include "body" with the same article text as "teaser" if you split fields—the server keeps the longer of "body" and "teaser".
            Rules: general wellness and health literacy only; varied topics across items.
            """;

    /**
     * Generic JSON-oriented completion for clinical pipelines (conversation analyzer / summary).
     * Caller owns the system prompt; response is raw model text (expected JSON).
     */
    public String completeClinicalJson(String systemPrompt, String userPrompt, int maxOutputTokens) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "Smart AI is not configured on this environment."
            );
        }
        int tokens = Math.min(4096, Math.max(256, maxOutputTokens));
        try {
            String requestBody = buildRequestBody(
                    Objects.toString(systemPrompt, "").trim(),
                    List.of(),
                    Objects.toString(userPrompt, "").trim(),
                    tokens,
                    0.2
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, chatPath)))
                    .timeout(Duration.ofMillis(Math.max(timeoutMs, 90_000)))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "Clinical AI completion failed.",
                        "openai",
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
            String requestBody = buildRequestBody(aiSafetyPolicy.systemPrompt(), history, message, maxTokens, temperature);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, chatPath)))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "OpenAI provider is temporarily unavailable.",
                        "openai",
                        response.statusCode(),
                        ""
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

    private String buildRequestBody(
            String systemContent,
            List<AiChatMessageDto> history,
            String message,
            int maxTokensParam,
            double temperatureParam
    ) throws IOException {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", Objects.toString(systemContent, "").trim()));
        if (history != null) {
            for (AiChatMessageDto item : history) {
                if (item == null) continue;
                String role = Objects.toString(item.role(), "").trim();
                String content = Objects.toString(item.content(), "").trim();
                if (content.isBlank()) continue;
                if (!"assistant".equals(role) && !"user".equals(role)) continue;
                messages.add(Map.of("role", role, "content", content));
            }
        }
        messages.add(Map.of("role", "user", "content", Objects.toString(message, "").trim()));

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("max_tokens", maxTokensParam);
        payload.put("temperature", temperatureParam);
        return objectMapper.writeValueAsString(payload);
    }

    private String parseResponseText(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            return "";
        }
        JsonNode first = choices.get(0);
        String fromMessage = extractOpenAiAssistantText(first.path("message"));
        if (!fromMessage.isBlank()) {
            return fromMessage;
        }
        return first.path("text").asText("");
    }

    /**
     * Newer chat completions may return {@code message.content} as an array of parts
     * ({@code type}/{@code text}) instead of a plain string; string path would yield empty and break JSON parsing.
     */
    private static String extractOpenAiAssistantText(JsonNode messageNode) {
        if (messageNode == null || messageNode.isMissingNode() || messageNode.isNull()) {
            return "";
        }
        JsonNode contentNode = messageNode.path("content");
        if (contentNode.isNull() || contentNode.isMissingNode()) {
            return "";
        }
        if (contentNode.isTextual()) {
            return contentNode.asText("");
        }
        if (contentNode.isArray()) {
            StringBuilder sb = new StringBuilder();
            for (JsonNode part : contentNode) {
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
        return "";
    }

    private static String joinUrl(String base, String path) {
        if (base.endsWith("/") && path.startsWith("/")) return base + path.substring(1);
        if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
        return base + path;
    }
}
