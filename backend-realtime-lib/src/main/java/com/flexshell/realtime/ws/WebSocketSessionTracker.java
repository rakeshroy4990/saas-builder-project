package com.flexshell.realtime.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketSessionTracker {
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public void put(WebSocketSession session) {
        if (session == null || session.getId() == null) return;
        sessions.put(session.getId(), session);
    }

    public void remove(String sessionId) {
        if (sessionId == null) return;
        sessions.remove(sessionId);
    }

    public WebSocketSession get(String sessionId) {
        if (sessionId == null) return null;
        return sessions.get(sessionId);
    }
}

