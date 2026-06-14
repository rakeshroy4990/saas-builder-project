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

    /** Sessions that recorded an {@code app_crash} / {@code flow=crash} / summary {@code kind=crash}. */
    default CrashSessionPage findCrashSessions(int page, int size) {
        return CrashSessionPage.empty(page, size);
    }

    /** Sessions whose derived {@code sessionFlow} includes at least one error step. */
    default CrashSessionPage findFlowErrorSessions(int page, int size) {
        return CrashSessionPage.empty(page, size);
    }
}
