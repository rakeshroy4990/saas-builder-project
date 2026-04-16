package com.flexshell.realtime.ws.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WsSessionAuthRegistry {
    public record SessionAuth(String userId, Instant expiresAt) {}

    private final Map<String, SessionAuth> bySessionId = new ConcurrentHashMap<>();

    public void put(String sessionId, SessionAuth auth) {
        if (sessionId == null || sessionId.isBlank() || auth == null) return;
        bySessionId.put(sessionId, auth);
    }

    public SessionAuth get(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return null;
        return bySessionId.get(sessionId);
    }

    public void remove(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return;
        bySessionId.remove(sessionId);
    }

    public Map<String, SessionAuth> snapshot() {
        return Map.copyOf(bySessionId);
    }
}

