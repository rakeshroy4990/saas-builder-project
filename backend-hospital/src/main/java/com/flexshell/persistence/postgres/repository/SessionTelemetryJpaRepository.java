package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.SessionTelemetryJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SessionTelemetryJpaRepository extends JpaRepository<SessionTelemetryJpaEntity, String> {

    Optional<SessionTelemetryJpaEntity> findFirstBySessionKeyAndDeletedFalseOrderByUpdatedAtDesc(String sessionKey);

    Optional<SessionTelemetryJpaEntity> findFirstByTraceIdAndDeletedFalseOrderByUpdatedAtDesc(String traceId);
}
