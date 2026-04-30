package com.flexshell.service;

import com.flexshell.controller.dto.SessionTelemetryEventRequest;
import com.flexshell.telemetry.SessionTelemetryEntity;
import com.flexshell.telemetry.SessionTelemetryRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class SessionTelemetryService {
    private final ObjectProvider<SessionTelemetryRepository> sessionTelemetryRepositoryProvider;

    public SessionTelemetryService(ObjectProvider<SessionTelemetryRepository> sessionTelemetryRepositoryProvider) {
        this.sessionTelemetryRepositoryProvider = sessionTelemetryRepositoryProvider;
    }

    public Map<String, Object> ingestSessionEvent(String actorUserId, SessionTelemetryEventRequest request) {
        SessionTelemetryRepository repository = requireSessionTelemetryRepository();
        String userId = normalize(actorUserId);
        if (userId.isBlank()) {
            userId = normalize(request.getUserId());
        }
        if (userId.isBlank()) {
            userId = "anonymous";
        }
        String traceId = normalize(request.getTraceId());
        String sessionKey = userId + "::" + traceId;
        Instant now = Instant.now();

        SessionTelemetryEntity entity = repository.findBySessionKey(sessionKey).orElseGet(SessionTelemetryEntity::new);
        if (entity.getSessionKey() == null || entity.getSessionKey().isBlank()) {
            entity.setSessionKey(sessionKey);
            entity.setUserId(userId);
            entity.setTraceId(traceId);
            entity.setStartedAt(now);
            entity.setTotalEvents(0);
            entity.setEventCounts(new HashMap<>());
            entity.setFlowCounts(new HashMap<>());
        }

        entity.setUpdatedAt(now);
        entity.setTotalEvents(entity.getTotalEvents() + 1);
        increment(entity.getEventCounts(), normalize(request.getEventName()));
        increment(entity.getFlowCounts(), normalize(request.getFlow()));
        entity.setLastEventName(normalize(request.getEventName()));
        entity.setLastFlow(normalize(request.getFlow()));
        entity.setLastStatus(normalize(request.getStatus()));
        entity.setLastReasonCode(normalize(request.getReasonCode()));
        entity.setLastHttpStatus(request.getHttpStatus());

        SessionTelemetryEntity saved = repository.save(entity);
        Map<String, Object> out = new HashMap<>();
        out.put("sessionKey", saved.getSessionKey());
        out.put("totalEvents", saved.getTotalEvents());
        return out;
    }

    private static void increment(Map<String, Integer> map, String key) {
        if (key == null || key.isBlank()) return;
        map.put(key, map.getOrDefault(key, 0) + 1);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private SessionTelemetryRepository requireSessionTelemetryRepository() {
        SessionTelemetryRepository repository = sessionTelemetryRepositoryProvider.getIfAvailable();
        if (repository == null) {
            throw new IllegalStateException("Session telemetry repository is unavailable");
        }
        return repository;
    }
}
