package com.flexshell.realtime.webrtc;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CallSessionHeartbeatRegistry {
    private final Map<String, Instant> lastHeartbeatByCallId = new ConcurrentHashMap<>();

    public void beat(String callId) {
        if (callId == null || callId.isBlank()) return;
        lastHeartbeatByCallId.put(callId, Instant.now());
    }

    public Instant lastBeat(String callId) {
        if (callId == null || callId.isBlank()) return null;
        return lastHeartbeatByCallId.get(callId);
    }

    public void remove(String callId) {
        if (callId == null || callId.isBlank()) return;
        lastHeartbeatByCallId.remove(callId);
    }
}

