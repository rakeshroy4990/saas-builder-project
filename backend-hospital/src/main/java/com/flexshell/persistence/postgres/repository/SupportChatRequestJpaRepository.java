package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.SupportChatRequestJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface SupportChatRequestJpaRepository extends JpaRepository<SupportChatRequestJpaEntity, String> {

    List<SupportChatRequestJpaEntity> findTop20ByStatusAndDeletedFalseOrderByCreatedAtDesc(String status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE SupportChatRequestJpaEntity e
            SET e.status = :nextStatus,
                e.assignedAgentUserId = :agentUserId,
                e.updatedAt = :updatedAt
            WHERE e.id = :requestId
              AND e.status = :openStatus
              AND e.deleted = false
            """)
    int updateOpenRequest(
            @Param("requestId") String requestId,
            @Param("agentUserId") String agentUserId,
            @Param("nextStatus") String nextStatus,
            @Param("openStatus") String openStatus,
            @Param("updatedAt") Instant updatedAt
    );
}
