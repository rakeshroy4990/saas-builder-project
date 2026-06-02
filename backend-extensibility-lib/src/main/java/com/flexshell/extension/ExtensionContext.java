package com.flexshell.extension;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Request-scoped context for extension hooks (no PHI in toString).
 */
public final class ExtensionContext {
    private final Map<String, Object> attributes = new HashMap<>();

    public ExtensionContext put(String key, Object value) {
        if (value != null) {
            attributes.put(key, value);
        }
        return this;
    }

    public Object get(String key) {
        return attributes.get(key);
    }

    public boolean isStrictMode() {
        return Boolean.TRUE.equals(attributes.get("strictMode"));
    }

    public Map<String, Object> asMap() {
        return Collections.unmodifiableMap(attributes);
    }

    public static ExtensionContext of(String userId, String role, String clientIp, String userAgent) {
        return new ExtensionContext()
                .put("userId", userId)
                .put("role", role)
                .put("clientIp", clientIp)
                .put("userAgent", userAgent)
                .put("strictMode", false);
    }
}
