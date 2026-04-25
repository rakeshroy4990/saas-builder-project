package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AiChatMessageDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class ClaudeChatAdapter {
    private final ObjectMapper objectMapper;
    private final AiSafetyPolicy aiSafetyPolicy;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final String chatPath;
    private final String apiVersion;
    private final int maxTokens;
    private final double temperature;
    private final int timeoutMs;

    public ClaudeChatAdapter(
            ObjectMapper objectMapper,
            AiSafetyPolicy aiSafetyPolicy,
            @Value("${app.ai.claude.api-key:}") String apiKey,
            @Value("${app.ai.claude.model:claude-3-5-sonnet-latest}") String model,
            @Value("${app.ai.claude.base-url:https://api.anthropic.com}") String baseUrl,
            @Value("${app.ai.claude.chat-path:/v1/messages}") String chatPath,
            @Value("${app.ai.claude.version:2023-06-01}") String apiVersion,
            @Value("${app.ai.max-tokens:400}") int maxTokens,
            @Value("${app.ai.temperature:0.3}") double temperature,
            @Value("${app.ai.timeout-ms:12000}") int timeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.aiSafetyPolicy = aiSafetyPolicy;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(Math.max(timeoutMs, 2000))).build();
        this.apiKey = Objects.toString(apiKey, "").trim();
        this.model = Objects.toString(model, "claude-3-5-sonnet-latest").trim();
        this.baseUrl = Objects.toString(baseUrl, "https://api.anthropic.com").trim();
        this.chatPath = Objects.toString(chatPath, "/v1/messages").trim();
        this.apiVersion = Objects.toString(apiVersion, "2023-06-01").trim();
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
            String requestBody = buildRequestBody(history, message);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, chatPath)))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", apiVersion)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "Claude provider is temporarily unavailable.",
                        "claude",
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

    private String buildRequestBody(List<AiChatMessageDto> history, String message) throws IOException {
        List<Map<String, Object>> messages = new ArrayList<>();
        if (history != null) {
            for (AiChatMessageDto item : history) {
                if (item == null) continue;
                String role = Objects.toString(item.role(), "").trim();
                String content = Objects.toString(item.content(), "").trim();
                if (content.isBlank()) continue;
                if (!"assistant".equals(role) && !"user".equals(role)) continue;
                messages.add(Map.of(
                        "role", role,
                        "content", List.of(Map.of("type", "text", "text", content))
                ));
            }
        }
        messages.add(Map.of(
                "role", "user",
                "content", List.of(Map.of("type", "text", "text", message))
        ));

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", model);
        payload.put("system", aiSafetyPolicy.systemPrompt());
        payload.put("messages", messages);
        payload.put("max_tokens", maxTokens);
        payload.put("temperature", temperature);
        return objectMapper.writeValueAsString(payload);
    }

    private String parseResponseText(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        JsonNode content = root.path("content");
        if (!content.isArray() || content.isEmpty()) {
            return "";
        }
        return content.get(0).path("text").asText("");
    }

    private static String joinUrl(String base, String path) {
        if (base.endsWith("/") && path.startsWith("/")) return base + path.substring(1);
        if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
        return base + path;
    }
}
