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
public class OpenAiChatAdapter {
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
            @Value("${app.ai.blog.temperature:0.75}") double blogTemperature
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
        return choices.get(0).path("message").path("content").asText("");
    }

    private static String joinUrl(String base, String path) {
        if (base.endsWith("/") && path.startsWith("/")) return base + path.substring(1);
        if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
        return base + path;
    }
}
