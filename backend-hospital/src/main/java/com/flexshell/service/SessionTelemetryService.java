package com.flexshell.service;

import com.flexshell.controller.dto.SessionSummaryEntryDto;
import com.flexshell.controller.dto.SessionTelemetryEventRequest;
import com.flexshell.telemetry.SessionSummaryEntryDocument;
import com.flexshell.telemetry.SessionTelemetryEntity;
import com.flexshell.telemetry.SessionTelemetryRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SessionTelemetryService {
    private static final int MAX_SESSION_SUMMARY = 2000;

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

        SessionTelemetryEntity entity = repository.findTop1BySessionKeyOrderByUpdatedAtDesc(sessionKey)
                .orElseGet(SessionTelemetryEntity::new);
        if (entity.getSessionKey() == null || entity.getSessionKey().isBlank()) {
            entity.setSessionKey(sessionKey);
            entity.setUserId(userId);
            entity.setTraceId(traceId);
            entity.setStartedAt(now);
            entity.setTotalEvents(0);
            entity.setEventCounts(new HashMap<>());
            entity.setFlowCounts(new HashMap<>());
            entity.setSessionSummary(new ArrayList<>());
        }

        entity.setUpdatedAt(now);
        // Session summary rows use the same POST body shape but must not count as telemetry "events"
        // (avoids EventCounts.session_summary_row, FlowCounts.session, LastEventName noise).
        if (request.getSessionSummaryEntry() == null) {
            entity.setTotalEvents(entity.getTotalEvents() + 1);
            increment(entity.getEventCounts(), normalize(request.getEventName()));
            increment(entity.getFlowCounts(), normalize(request.getFlow()));
            entity.setLastEventName(normalize(request.getEventName()));
            entity.setLastFlow(normalize(request.getFlow()));
            entity.setLastStatus(normalize(request.getStatus()));
            entity.setLastReasonCode(normalize(request.getReasonCode()));
            entity.setLastHttpStatus(request.getHttpStatus());
        }

        if (request.getSessionSummaryEntry() != null && !"anonymous".equals(userId)) {
            mergeSessionSummary(entity, request.getSessionSummaryEntry(), now);
        }

        SessionTelemetryEntity saved = repository.save(entity);
        Map<String, Object> out = new HashMap<>();
        out.put("sessionKey", saved.getSessionKey());
        out.put("totalEvents", saved.getTotalEvents());
        out.put("sessionSummarySize", saved.getSessionSummary() == null ? 0 : saved.getSessionSummary().size());
        return out;
    }

    /**
     * Latest telemetry row for a browser tab trace (used by support / session review UI).
     * When nothing is stored yet, returns a non-throwing map with zeros / empty summary (not 404).
     */
    public Map<String, Object> findSnapshotByTraceId(String traceId) {
        SessionTelemetryRepository repository = requireSessionTelemetryRepository();
        String normalized = normalize(traceId);
        if (normalized.isBlank()) {
            return emptySnapshotMap(normalized);
        }
        return repository.findTop1ByTraceIdOrderByUpdatedAtDesc(normalized)
                .map(this::toSnapshotMap)
                .orElseGet(() -> emptySnapshotMap(normalized));
    }

    private Map<String, Object> emptySnapshotMap(String traceId) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("sessionKey", null);
        row.put("userId", null);
        row.put("traceId", traceId.isEmpty() ? null : traceId);
        row.put("startedAt", null);
        row.put("updatedAt", null);
        row.put("totalEvents", 0);
        row.put("sessionSummary", new ArrayList<>());
        row.put("sessionSummarySize", 0);
        row.put("lastEventName", null);
        row.put("lastFlow", null);
        row.put("lastStatus", null);
        return row;
    }

    private Map<String, Object> toSnapshotMap(SessionTelemetryEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("sessionKey", entity.getSessionKey());
        row.put("userId", entity.getUserId());
        row.put("traceId", entity.getTraceId());
        row.put("startedAt", entity.getStartedAt() != null ? entity.getStartedAt().toString() : null);
        row.put("updatedAt", entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null);
        row.put("totalEvents", entity.getTotalEvents());
        List<SessionSummaryEntryDocument> summary = entity.getSessionSummary();
        row.put("sessionSummary", summary != null ? summary : new ArrayList<>());
        row.put("sessionSummarySize", summary == null ? 0 : summary.size());
        row.put("lastEventName", entity.getLastEventName());
        row.put("lastFlow", entity.getLastFlow());
        row.put("lastStatus", entity.getLastStatus());
        return row;
    }

    private void mergeSessionSummary(SessionTelemetryEntity entity, SessionSummaryEntryDto incoming, Instant now) {
        String entryId = normalize(incoming.getEntryId());
        String kind = normalize(incoming.getKind());
        if (entryId.isEmpty() || kind.isEmpty()) {
            throw new IllegalArgumentException("session_summary_entry requires entry_id and kind");
        }
        List<SessionSummaryEntryDocument> list = entity.getSessionSummary();
        if (list == null) {
            list = new ArrayList<>();
        } else {
            list = new ArrayList<>(list);
        }
        for (SessionSummaryEntryDocument existing : list) {
            if (entryId.equals(normalize(existing.getEntryId()))) {
                return;
            }
        }
        list.add(mapToDocument(incoming, now));
        while (list.size() > MAX_SESSION_SUMMARY) {
            list.remove(0);
        }
        entity.setSessionSummary(list);
    }

    private static SessionSummaryEntryDocument mapToDocument(SessionSummaryEntryDto dto, Instant fallbackNow) {
        SessionSummaryEntryDocument doc = new SessionSummaryEntryDocument();
        doc.setEntryId(dto.getEntryId());
        String occurred = normalize(dto.getOccurredAt());
        doc.setOccurredAt(occurred.isEmpty() ? fallbackNow.toString() : occurred);
        doc.setKind(dto.getKind());
        doc.setPageId(emptyToNull(dto.getPageId()));
        doc.setPackageName(emptyToNull(dto.getPackageName()));
        doc.setComponentId(emptyToNull(dto.getComponentId()));
        doc.setPopupPageId(emptyToNull(dto.getPopupPageId()));
        doc.setRoutePath(emptyToNull(dto.getRoutePath()));
        doc.setApiPath(emptyToNull(dto.getApiPath()));
        doc.setHttpMethod(emptyToNull(dto.getHttpMethod()));
        doc.setHttpStatus(dto.getHttpStatus());
        doc.setDurationMs(dto.getDurationMs());
        doc.setErrorMessage(emptyToNull(dto.getErrorMessage()));
        doc.setReasonCode(emptyToNull(dto.getReasonCode()));
        doc.setActionAlias(emptyToNull(dto.getActionAlias()));
        doc.setActionId(emptyToNull(dto.getActionId()));
        doc.setUserEmail(emptyToNull(dto.getUserEmail()));
        if (dto.getAttributes() != null && !dto.getAttributes().isEmpty()) {
            doc.setAttributes(new LinkedHashMap<>(dto.getAttributes()));
        }
        return doc;
    }

    private static String emptyToNull(String value) {
        String n = normalize(value);
        return n.isEmpty() ? null : n;
    }

    private static void increment(Map<String, Integer> map, String key) {
        if (key == null || key.isBlank()) return;
        map.put(key, map.getOrDefault(key, 0) + 1);
    }

    private static String normalize(String value) {
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
