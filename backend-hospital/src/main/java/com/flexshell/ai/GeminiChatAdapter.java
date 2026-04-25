package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AiChatMessageDto;
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
import java.util.LinkedHashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class GeminiChatAdapter {
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

    public GeminiChatAdapter(
            ObjectMapper objectMapper,
            AiSafetyPolicy aiSafetyPolicy,
            @Value("${app.ai.gemini.api-key:}") String apiKey,
            @Value("${app.ai.gemini.model:gemini-1.5-flash}") String model,
            @Value("${app.ai.gemini.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
            @Value("${app.ai.gemini.chat-path-template:/v1beta/models/%s:generateContent}") String pathTemplate,
            @Value("${app.ai.max-tokens:400}") int maxTokens,
            @Value("${app.ai.temperature:0.3}") double temperature,
            @Value("${app.ai.timeout-ms:12000}") int timeoutMs
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
        contents.add(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", buildCombinedUserText(history, message)))
        ));

        Map<String, Object> payload = new HashMap<>();
        payload.put("systemInstruction", Map.of("parts", List.of(Map.of("text", aiSafetyPolicy.systemPrompt()))));
        payload.put("contents", contents);
        payload.put("generationConfig", Map.of(
                "temperature", temperature,
                "maxOutputTokens", maxTokens
        ));
        return objectMapper.writeValueAsString(payload);
    }

    private static String buildCombinedUserText(List<AiChatMessageDto> history, String latestMessage) {
        LinkedHashSet<String> uniqueUserInputs = new LinkedHashSet<>();
        if (history != null) {
            for (AiChatMessageDto item : history) {
                if (item == null) continue;
                String role = Objects.toString(item.role(), "").trim().toLowerCase();
                if (!"user".equals(role)) continue;
                String content = Objects.toString(item.content(), "").trim();
                if (!content.isBlank()) {
                    uniqueUserInputs.add(content);
                }
            }
        }
        String latest = Objects.toString(latestMessage, "").trim();
        if (!latest.isBlank()) {
            uniqueUserInputs.add(latest);
        }
        if (uniqueUserInputs.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder("Patient-reported symptoms/context:\n");
        int idx = 1;
        for (String text : uniqueUserInputs) {
            out.append(idx++).append(". ").append(text).append('\n');
        }
        out.append("\nPlease respond to the latest concern using the required triage format.");
        return out.toString().trim();
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
        return parts.get(0).path("text").asText("");
    }

    private static String joinUrl(String base, String path) {
        if (base.endsWith("/") && path.startsWith("/")) return base + path.substring(1);
        if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
        return base + path;
    }
}
