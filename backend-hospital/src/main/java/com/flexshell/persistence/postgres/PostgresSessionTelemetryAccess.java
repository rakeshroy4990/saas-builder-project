package com.flexshell.persistence.postgres;

import com.flexshell.persistence.api.SessionTelemetryAccess;
import com.flexshell.persistence.postgres.model.SessionTelemetryJpaEntity;
import com.flexshell.persistence.postgres.repository.SessionTelemetryJpaRepository;
import com.flexshell.telemetry.SessionSummaryEntryDocument;
import com.flexshell.telemetry.SessionTelemetryEntity;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresSessionTelemetryAccess implements SessionTelemetryAccess {

    private final SessionTelemetryJpaRepository jpaRepository;

    public PostgresSessionTelemetryAccess(SessionTelemetryJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<SessionTelemetryEntity> findTopBySessionKeyOrderByUpdatedAtDesc(String sessionKey) {
        return jpaRepository.findFirstBySessionKeyAndDeletedFalseOrderByUpdatedAtDesc(sessionKey).map(this::toDomain);
    }

    @Override
    public Optional<SessionTelemetryEntity> findTopByTraceIdOrderByUpdatedAtDesc(String traceId) {
        return jpaRepository.findFirstByTraceIdAndDeletedFalseOrderByUpdatedAtDesc(traceId).map(this::toDomain);
    }

    @Override
    public SessionTelemetryEntity save(SessionTelemetryEntity entity) {
        Optional<SessionTelemetryJpaEntity> existing = Optional.empty();
        if (entity.getId() != null && !entity.getId().isBlank()) {
            existing = jpaRepository.findById(entity.getId()).filter(e -> !e.isDeleted());
        }
        SessionTelemetryJpaEntity row = toJpa(entity, existing.orElse(null));
        SessionTelemetryJpaEntity saved = jpaRepository.save(row);
        return toDomain(saved);
    }

    private SessionTelemetryEntity toDomain(SessionTelemetryJpaEntity j) {
        SessionTelemetryEntity e = new SessionTelemetryEntity();
        e.setId(j.getId());
        e.setSessionKey(j.getSessionKey());
        e.setUserId(j.getUserId());
        e.setTraceId(j.getTraceId());
        e.setStartedAt(j.getStartedAt());
        e.setUpdatedAt(j.getUpdatedAt());
        e.setTotalEvents(j.getTotalEvents());
        e.setEventCounts(j.getEventCounts() == null ? new HashMap<>() : new HashMap<>(j.getEventCounts()));
        e.setFlowCounts(j.getFlowCounts() == null ? new HashMap<>() : new HashMap<>(j.getFlowCounts()));
        e.setLastEventName(j.getLastEventName());
        e.setLastFlow(j.getLastFlow());
        e.setLastStatus(j.getLastStatus());
        e.setLastReasonCode(j.getLastReasonCode());
        e.setLastHttpStatus(j.getLastHttpStatus());
        e.setSessionSummary(
                j.getSessionSummary() == null ? new ArrayList<>() : new ArrayList<>(j.getSessionSummary()));
        return e;
    }

    private SessionTelemetryJpaEntity toJpa(SessionTelemetryEntity d, SessionTelemetryJpaEntity existing) {
        SessionTelemetryJpaEntity row = existing != null ? existing : new SessionTelemetryJpaEntity();
        if (existing == null) {
            if (d.getId() != null && !d.getId().isBlank()) {
                row.setId(d.getId());
            } else {
                row.setId(new ObjectId().toHexString());
            }
        }
        row.setSessionKey(d.getSessionKey());
        row.setUserId(d.getUserId());
        row.setTraceId(d.getTraceId());
        row.setStartedAt(d.getStartedAt());
        row.setUpdatedAt(d.getUpdatedAt());
        row.setTotalEvents(d.getTotalEvents());
        row.setEventCounts(d.getEventCounts() == null ? new HashMap<>() : new HashMap<>(d.getEventCounts()));
        row.setFlowCounts(d.getFlowCounts() == null ? new HashMap<>() : new HashMap<>(d.getFlowCounts()));
        row.setLastEventName(d.getLastEventName());
        row.setLastFlow(d.getLastFlow());
        row.setLastStatus(d.getLastStatus());
        row.setLastReasonCode(d.getLastReasonCode());
        row.setLastHttpStatus(d.getLastHttpStatus());
        List<SessionSummaryEntryDocument> summary = d.getSessionSummary();
        row.setSessionSummary(summary == null ? new ArrayList<>() : new ArrayList<>(summary));
        row.setDeleted(false);
        return row;
    }
}
