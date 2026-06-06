package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.NotificationEventRuleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationEventRuleJpaRepository extends JpaRepository<NotificationEventRuleJpaEntity, Long> {

    List<NotificationEventRuleJpaEntity> findByEventTypeIgnoreCaseAndEnabledTrueAndDeletedFalseOrderBySortOrderAscIdAsc(
            String eventType
    );

    Optional<NotificationEventRuleJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Optional<NotificationEventRuleJpaEntity> findByEventTypeIgnoreCaseAndRecipientRoleIgnoreCaseAndDeletedFalse(
            String eventType,
            String recipientRole
    );

    List<NotificationEventRuleJpaEntity> findByDeletedFalseOrderByEventTypeAscSortOrderAscIdAsc();
}
