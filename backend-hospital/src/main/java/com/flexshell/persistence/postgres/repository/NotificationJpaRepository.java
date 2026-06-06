package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.NotificationJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationJpaRepository extends JpaRepository<NotificationJpaEntity, Long> {

    Optional<NotificationJpaEntity> findByExternalIdAndRecipientUserIdAndDeletedFalse(
            UUID externalId,
            String recipientUserId
    );

    Page<NotificationJpaEntity> findByRecipientUserIdAndDeletedFalseOrderByCreatedAtDesc(
            String recipientUserId,
            Pageable pageable
    );

    Page<NotificationJpaEntity> findByRecipientUserIdAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(
            String recipientUserId,
            Pageable pageable
    );

    long countByRecipientUserIdAndReadFalseAndDeletedFalse(String recipientUserId);

    @Modifying
    @Query("""
            UPDATE NotificationJpaEntity n
            SET n.read = true, n.readAt = :readAt
            WHERE n.recipientUserId = :recipientUserId
              AND n.read = false
              AND n.deleted = false
            """)
    int markAllReadForUser(@Param("recipientUserId") String recipientUserId, @Param("readAt") Instant readAt);
}
