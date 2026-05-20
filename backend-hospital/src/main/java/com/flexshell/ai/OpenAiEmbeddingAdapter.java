package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
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

@Component
public class OpenAiEmbeddingAdapter {

    private static final Logger LOG = LoggerFactory.getLogger(OpenAiEmbeddingAdapter.class);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final int embeddingDimension;
    private final String embeddingsUrl;

    public OpenAiEmbeddingAdapter(
            ObjectMapper objectMapper,
            @Value("${app.ai.openai.api-key:}") String apiKey,
            @Value("${app.ai.openai.embedding-model:text-embedding-3-large}") String model,
            @Value("${app.ai.openai.embedding-dimension:3072}") int embeddingDimension,
            @Value("${app.ai.openai.base-url:https://api.openai.com}") String baseUrl,
            @Value("${app.ai.openai.embedding-path:/v1/embeddings}") String embeddingPath
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = Objects.toString(apiKey, "").trim();
        this.model = Objects.toString(model, "text-embedding-3-large").trim();
        this.embeddingDimension = Math.max(1, embeddingDimension);
        String rawBase = Objects.toString(baseUrl, "https://api.openai.com").trim();
        String normalizedBase = rawBase.endsWith("/") ? rawBase.substring(0, rawBase.length() - 1) : rawBase;
        String path = Objects.toString(embeddingPath, "/v1/embeddings").trim();
        this.embeddingsUrl = joinUrl(normalizedBase, path);
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public int embeddingDimension() {
        return embeddingDimension;
    }

    public List<Double> embedText(String text) {
        List<List<Double>> batch = embedTexts(List.of(text));
        return batch.isEmpty() ? List.of() : batch.get(0);
    }

    /**
     * Batch embedding (OpenAI {@code input} array). Returns vectors in the same order as non-blank inputs;
     * blank inputs are skipped — caller should map by index of non-blank texts only.
     */
    public List<List<Double>> embedTexts(List<String> texts) {
        if (!isConfigured()) {
            LOG.warn("openai_embedding_skipped reason=api_key_missing");
            return List.of();
        }
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        List<String> inputs = new ArrayList<>();
        for (String raw : texts) {
            String t = Objects.toString(raw, "").trim();
            if (!t.isBlank()) {
                inputs.add(t);
            }
        }
        if (inputs.isEmpty()) {
            return List.of();
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("input", inputs);
            payload.put("dimensions", embeddingDimension);
            String json = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(embeddingsUrl))
                    .timeout(Duration.ofSeconds(90))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.warn(
                        "openai_embedding_batch_failed status={} bodyChars={}",
                        response.statusCode(),
                        response.body() == null ? 0 : response.body().length()
                );
                return List.of();
            }
            return parseEmbeddingBatch(objectMapper.readTree(response.body()), inputs.size());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            LOG.warn("openai_embedding_interrupted");
            return List.of();
        } catch (IOException ex) {
            LOG.warn("openai_embedding_io_error type={}", ex.getClass().getSimpleName());
            return List.of();
        }
    }

    private List<List<Double>> parseEmbeddingBatch(JsonNode root, int expectedCount) {
        JsonNode data = root.path("data");
        if (!data.isArray() || data.size() != expectedCount) {
            LOG.warn(
                    "openai_embedding_batch_failed reason=unexpected_data_size expected={} actual={}",
                    expectedCount,
                    data.isArray() ? data.size() : -1
            );
            return List.of();
        }
        List<List<Double>> ordered = new ArrayList<>();
        for (int i = 0; i < data.size(); i++) {
            JsonNode item = data.get(i);
            int index = item.path("index").asInt(i);
            while (ordered.size() <= index) {
                ordered.add(List.of());
            }
            JsonNode embedding = item.path("embedding");
            if (!embedding.isArray()) {
                ordered.set(index, List.of());
                continue;
            }
            List<Double> vector = new ArrayList<>();
            for (JsonNode n : embedding) {
                vector.add(n.asDouble());
            }
            if (vector.size() != embeddingDimension) {
                LOG.warn(
                        "openai_embedding_dimension_mismatch expected={} actual={} index={}",
                        embeddingDimension,
                        vector.size(),
                        index
                );
                ordered.set(index, List.of());
            } else {
                ordered.set(index, vector);
            }
        }
        List<List<Double>> result = new ArrayList<>();
        for (int i = 0; i < expectedCount; i++) {
            result.add(i < ordered.size() ? ordered.get(i) : List.of());
        }
        return result;
    }

    private static String joinUrl(String base, String path) {
        if (base.endsWith("/") && path.startsWith("/")) {
            return base + path.substring(1);
        }
        if (!base.endsWith("/") && !path.startsWith("/")) {
            return base + "/" + path;
        }
        return base + path;
    }

    public static String toPgVectorLiteral(List<Double> vector) {
        if (vector == null || vector.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(vector.get(i));
        }
        sb.append(']');
        return sb.toString();
    }
}
