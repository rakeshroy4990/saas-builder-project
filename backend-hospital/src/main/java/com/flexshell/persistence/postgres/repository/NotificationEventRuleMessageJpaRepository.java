package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.NotificationEventRuleMessageJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationEventRuleMessageJpaRepository extends JpaRepository<NotificationEventRuleMessageJpaEntity, Long> {

    Optional<NotificationEventRuleMessageJpaEntity> findByRuleIdAndLocaleIgnoreCaseAndDeletedFalse(
            Long ruleId,
            String locale
    );

    List<NotificationEventRuleMessageJpaEntity> findByRuleIdAndDeletedFalseOrderByLocaleAsc(Long ruleId);
}
