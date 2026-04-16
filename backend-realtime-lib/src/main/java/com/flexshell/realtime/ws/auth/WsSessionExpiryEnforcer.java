package com.flexshell.realtime.ws.auth;

import com.flexshell.realtime.ws.WebSocketSessionTracker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.Map;

@Component
public class WsSessionExpiryEnforcer {
    private static final Logger log = LoggerFactory.getLogger(WsSessionExpiryEnforcer.class);

    private final WsSessionAuthRegistry authRegistry;
    private final WebSocketSessionTracker sessionTracker;

    public WsSessionExpiryEnforcer(WsSessionAuthRegistry authRegistry, WebSocketSessionTracker sessionTracker) {
        this.authRegistry = authRegistry;
        this.sessionTracker = sessionTracker;
    }

    @Scheduled(fixedDelayString = "${app.ws.session-expiry-scan-ms:30000}")
    public void disconnectExpiredSessions() {
        Instant now = Instant.now();
        for (Map.Entry<String, WsSessionAuthRegistry.SessionAuth> entry : authRegistry.snapshot().entrySet()) {
            String sessionId = entry.getKey();
            WsSessionAuthRegistry.SessionAuth auth = entry.getValue();
            if (auth == null || auth.expiresAt() == null) continue;
            if (now.isBefore(auth.expiresAt())) continue;

            WebSocketSession session = sessionTracker.get(sessionId);
            if (session == null) {
                authRegistry.remove(sessionId);
                continue;
            }
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
            } catch (Exception ex) {
                log.debug("Failed closing expired WS session {}: {}", sessionId, ex.getMessage());
            } finally {
                authRegistry.remove(sessionId);
                sessionTracker.remove(sessionId);
            }
        }
    }
}

