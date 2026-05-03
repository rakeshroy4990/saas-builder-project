package com.flexshell.persistence.api;

import com.flexshell.telemetry.SessionTelemetryEntity;

import java.util.Optional;

/**
 * Persistence port for {@link SessionTelemetryEntity} (Mongo or Postgres).
 */
public interface SessionTelemetryAccess {

    Optional<SessionTelemetryEntity> findTopBySessionKeyOrderByUpdatedAtDesc(String sessionKey);

    Optional<SessionTelemetryEntity> findTopByTraceIdOrderByUpdatedAtDesc(String traceId);

    SessionTelemetryEntity save(SessionTelemetryEntity entity);
}
