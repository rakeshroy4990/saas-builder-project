package com.flexshell.notification;

import com.flexshell.auth.i18n.SupportedLocale;
import com.flexshell.persistence.postgres.model.NotificationEventRuleJpaEntity;
import com.flexshell.persistence.postgres.model.NotificationEventRuleMessageJpaEntity;
import com.flexshell.persistence.postgres.repository.NotificationEventRuleJpaRepository;
import com.flexshell.persistence.postgres.repository.NotificationEventRuleMessageJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class NotificationRuleCatalog {

    private static final String DEFAULT_LOCALE = SupportedLocale.DEFAULT;

    private final NotificationEventRuleJpaRepository ruleRepository;
    private final NotificationEventRuleMessageJpaRepository messageRepository;

    public NotificationRuleCatalog(
            NotificationEventRuleJpaRepository ruleRepository,
            NotificationEventRuleMessageJpaRepository messageRepository
    ) {
        this.ruleRepository = ruleRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationEventRuleJpaEntity> findEnabledRulesForEvent(String eventType) {
        if (eventType == null || eventType.isBlank()) {
            return List.of();
        }
        return ruleRepository.findByEventTypeIgnoreCaseAndEnabledTrueAndDeletedFalseOrderBySortOrderAscIdAsc(
                eventType.trim()
        );
    }

    @Transactional(readOnly = true)
    public ResolvedRuleMessage resolveMessage(NotificationEventRuleJpaEntity rule, String preferredLocale) {
        String locale = normalizeLocale(preferredLocale);
        NotificationEventRuleMessageJpaEntity message = messageRepository
                .findByRuleIdAndLocaleIgnoreCaseAndDeletedFalse(rule.getId(), locale)
                .or(() -> messageRepository.findByRuleIdAndLocaleIgnoreCaseAndDeletedFalse(
                        rule.getId(),
                        DEFAULT_LOCALE
                ))
                .orElseThrow(() -> new IllegalStateException(
                        "No notification message templates for rule eventType="
                                + rule.getEventType()
                                + " role="
                                + rule.getRecipientRole()
                ));
        return new ResolvedRuleMessage(locale, message.getTitleTemplate(), message.getMessageTemplate());
    }

    @Transactional(readOnly = true)
    public List<NotificationEventRuleJpaEntity> listAllRules() {
        return ruleRepository.findByDeletedFalseOrderByEventTypeAscSortOrderAscIdAsc();
    }

    @Transactional(readOnly = true)
    public List<NotificationEventRuleMessageJpaEntity> listMessagesForRule(Long ruleId) {
        return messageRepository.findByRuleIdAndDeletedFalseOrderByLocaleAsc(ruleId);
    }

    public static String normalizeLocale(String preferredLocale) {
        return SupportedLocale.normalize(preferredLocale);
    }

    public record ResolvedRuleMessage(String locale, String titleTemplate, String messageTemplate) {
    }
}
