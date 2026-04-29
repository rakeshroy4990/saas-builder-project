package com.flexshell.observability;

import org.slf4j.Logger;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

public final class ObservabilityLogger {
    private ObservabilityLogger() {
    }

    public static void info(Logger log, String eventName, Map<String, ?> fields) {
        log.info(format(eventName, fields));
    }

    public static void warn(Logger log, String eventName, Map<String, ?> fields) {
        log.warn(format(eventName, fields));
    }

    /**
     * Base helper to keep domain/status/reason consistent and easy to extend.
     */
    public static Map<String, Object> fields(String domain, String status, String reasonCode) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("domain", domain);
        fields.put("status", status);
        fields.put("reason_code", reasonCode);
        return fields;
    }

    private static String format(String eventName, Map<String, ?> fields) {
        Map<String, Object> merged = new LinkedHashMap<>();
        merged.put("event_name", eventName);
        merged.putAll(fields == null ? Map.of() : fields);
        return merged.entrySet().stream()
                .map((entry) -> entry.getKey() + "=" + sanitize(entry.getValue()))
                .collect(Collectors.joining(" "));
    }

    private static String sanitize(Object value) {
        String text = Objects.toString(value, "");
        if (text.isBlank()) {
            return "na";
        }
        return text.replaceAll("\\s+", "_");
    }
}
