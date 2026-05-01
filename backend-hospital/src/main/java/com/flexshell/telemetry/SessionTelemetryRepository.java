package com.flexshell.telemetry;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SessionTelemetryRepository extends MongoRepository<SessionTelemetryEntity, String> {
    /**
     * Latest row for a tab trace. Use {@code Top1} (not {@code First}) so the query includes {@code limit(1)}:
     * duplicate {@code SessionKey} documents (legacy / races) otherwise make {@code findFirst...} throw
     * {@link org.springframework.dao.IncorrectResultSizeDataAccessException}.
     */
    Optional<SessionTelemetryEntity> findTop1BySessionKeyOrderByUpdatedAtDesc(String sessionKey);

    Optional<SessionTelemetryEntity> findTop1ByTraceIdOrderByUpdatedAtDesc(String traceId);
}
