package com.flexshell.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory sliding-window limiter for login attempts (per client IP).
 * For multi-instance production deployments, replace with Redis or API gateway limits.
 */
@Component
public class LoginRateLimiter {

    private final int maxAttempts;
    private final long windowSeconds;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public LoginRateLimiter(
            @Value("${app.auth.login-rate-limit.max-attempts-per-window:30}") int maxAttempts,
            @Value("${app.auth.login-rate-limit.window-seconds:900}") long windowSeconds) {
        this.maxAttempts = Math.max(5, maxAttempts);
        this.windowSeconds = Math.max(60L, windowSeconds);
    }

    /**
     * @return true if the request should be allowed; false if rate limit exceeded
     */
    public boolean allow(String clientKey) {
        if (clientKey == null || clientKey.isBlank()) {
            return true;
        }
        Instant now = Instant.now();
        long epochSec = now.getEpochSecond();
        long windowStart = epochSec - (epochSec % windowSeconds);
        String key = clientKey.trim() + ":" + windowStart;

        windows.entrySet().removeIf(e -> {
            String k = e.getKey();
            int idx = k.lastIndexOf(':');
            if (idx < 0) return false;
            try {
                long ws = Long.parseLong(k.substring(idx + 1));
                return epochSec - ws > windowSeconds * 2L;
            } catch (NumberFormatException ex) {
                return true;
            }
        });

        Window w = windows.computeIfAbsent(key, k -> new Window());
        synchronized (w) {
            if (w.count >= maxAttempts) {
                return false;
            }
            w.count++;
            return true;
        }
    }

    private static final class Window {
        private int count;
    }
}
