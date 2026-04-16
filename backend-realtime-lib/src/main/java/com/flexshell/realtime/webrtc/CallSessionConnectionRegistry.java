package com.flexshell.realtime.webrtc;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CallSessionConnectionRegistry {
    private final Map<String, String> callIdByWsSessionId = new ConcurrentHashMap<>();

    public void bind(String wsSessionId, String callId) {
        if (wsSessionId == null || wsSessionId.isBlank()) return;
        if (callId == null || callId.isBlank()) return;
        callIdByWsSessionId.put(wsSessionId, callId);
    }

    public String unbind(String wsSessionId) {
        if (wsSessionId == null || wsSessionId.isBlank()) return null;
        return callIdByWsSessionId.remove(wsSessionId);
    }
}

