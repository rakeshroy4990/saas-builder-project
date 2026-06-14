package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.SessionTelemetryJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SessionTelemetryJpaRepository extends JpaRepository<SessionTelemetryJpaEntity, String> {

    Optional<SessionTelemetryJpaEntity> findFirstBySessionKeyAndDeletedFalseOrderByUpdatedAtDesc(String sessionKey);

    Optional<SessionTelemetryJpaEntity> findFirstByTraceIdAndDeletedFalseOrderByUpdatedAtDesc(String traceId);

    @Query(
            value = """
                    SELECT st.* FROM session_telemetry st
                    WHERE st.deleted = false
                    AND (
                      st.last_flow = 'crash'
                      OR jsonb_exists(st.event_counts, 'app_crash')
                      OR EXISTS (
                        SELECT 1 FROM jsonb_array_elements(st.session_summary) elem
                        WHERE COALESCE(elem->>'Kind', elem->>'kind') = 'crash'
                      )
                    )
                    ORDER BY st.updated_at DESC
                    LIMIT :limit OFFSET :offset
                    """,
            nativeQuery = true
    )
    List<SessionTelemetryJpaEntity> findCrashSessions(@Param("limit") int limit, @Param("offset") int offset);

    @Query(
            value = """
                    SELECT count(*) FROM session_telemetry st
                    WHERE st.deleted = false
                    AND (
                      st.last_flow = 'crash'
                      OR jsonb_exists(st.event_counts, 'app_crash')
                      OR EXISTS (
                        SELECT 1 FROM jsonb_array_elements(st.session_summary) elem
                        WHERE COALESCE(elem->>'Kind', elem->>'kind') = 'crash'
                      )
                    )
                    """,
            nativeQuery = true
    )
    long countCrashSessions();

    @Query(
            value = """
                    SELECT st.* FROM session_telemetry st
                    WHERE st.deleted = false
                    AND st.flow_error_count > 0
                    ORDER BY st.updated_at DESC
                    LIMIT :limit OFFSET :offset
                    """,
            nativeQuery = true
    )
    List<SessionTelemetryJpaEntity> findFlowErrorSessions(@Param("limit") int limit, @Param("offset") int offset);

    @Query(
            value = """
                    SELECT count(*) FROM session_telemetry st
                    WHERE st.deleted = false
                    AND st.flow_error_count > 0
                    """,
            nativeQuery = true
    )
    long countFlowErrorSessions();
}
