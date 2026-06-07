package com.flexshell.controller.support;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Set;

/**
 * Merges URL-encoded {@code Query} JSON into a query DTO ({@code @ModelAttribute} fields take precedence).
 */
public final class EntityQueryBinder {

    private EntityQueryBinder() {
    }

    public static <T> T bind(T queryDto, String queryJson, ObjectMapper objectMapper, Set<String> allowedKeys) {
        Map<String, String> parsed = EntityQuerySupport.parseQueryJson(objectMapper, queryJson);
        EntityQuerySupport.rejectUnknownKeys(parsed, allowedKeys);
        if (parsed.isEmpty()) {
            return queryDto;
        }
        for (Map.Entry<String, String> entry : parsed.entrySet()) {
            applyField(queryDto, entry.getKey(), entry.getValue());
        }
        return queryDto;
    }

    private static void applyField(Object target, String wireName, String rawValue) {
        for (Field field : target.getClass().getDeclaredFields()) {
            com.fasterxml.jackson.annotation.JsonProperty prop = field.getAnnotation(
                    com.fasterxml.jackson.annotation.JsonProperty.class
            );
            String name = prop != null ? prop.value() : field.getName();
            if (!wireName.equals(name)) {
                continue;
            }
            field.setAccessible(true);
            try {
                Object current = field.get(target);
                if (current != null && !isBlank(current)) {
                    return;
                }
                field.set(target, coerce(field.getType(), rawValue));
            } catch (IllegalAccessException ex) {
                throw new IllegalArgumentException("Unable to bind query field: " + wireName);
            }
            return;
        }
        throw new IllegalArgumentException("Unknown query field: " + wireName);
    }

    private static boolean isBlank(Object value) {
        if (value instanceof String s) {
            return s.isBlank();
        }
        return false;
    }

    private static Object coerce(Class<?> type, String rawValue) {
        if (type == String.class) {
            return rawValue;
        }
        if (type == Boolean.class || type == boolean.class) {
            return Boolean.parseBoolean(rawValue);
        }
        if (type == Integer.class || type == int.class) {
            return Integer.parseInt(rawValue);
        }
        if (type == Long.class || type == long.class) {
            return Long.parseLong(rawValue);
        }
        return rawValue;
    }
}
