package com.flexshell.controller.support;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Shared helpers for entity list {@code Query} JSON query params (see entity-crud-endpoints.mdc).
 */
public final class EntityQuerySupport {

    private EntityQuerySupport() {
    }

    public static int safePage(int page) {
        return Math.max(page, 0);
    }

    public static int safeSize(int size) {
        return size <= 0 ? 20 : Math.min(size, 100);
    }

    public static Map<String, String> parseQueryJson(ObjectMapper objectMapper, String queryJson) {
        if (queryJson == null || queryJson.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode node = objectMapper.readTree(queryJson.trim());
            if (!node.isObject()) {
                throw new IllegalArgumentException("Query must be a JSON object");
            }
            Map<String, String> out = new LinkedHashMap<>();
            node.fields().forEachRemaining(entry -> {
                JsonNode value = entry.getValue();
                if (value != null && !value.isNull()) {
                    out.put(entry.getKey(), value.asText());
                }
            });
            return out;
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid Query JSON: " + ex.getMessage());
        }
    }

    public static void rejectUnknownKeys(Map<String, String> parsed, Set<String> allowedKeys) {
        for (String key : parsed.keySet()) {
            if (!allowedKeys.contains(key)) {
                throw new IllegalArgumentException("Unknown query field: " + key);
            }
        }
    }

    public static String pick(Map<String, String> parsed, String key) {
        if (parsed == null || parsed.isEmpty()) {
            return null;
        }
        String value = parsed.get(key);
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
