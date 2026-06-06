package com.flexshell.notification;

import com.flexshell.persistence.postgres.model.NotificationEventRuleJpaEntity;
import com.flexshell.persistence.postgres.model.NotificationEventRuleMessageJpaEntity;
import com.flexshell.persistence.postgres.repository.NotificationEventRuleJpaRepository;
import com.flexshell.persistence.postgres.repository.NotificationEventRuleMessageJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class NotificationRuleCatalog {

    private static final String DEFAULT_LOCALE = "en";
    private static final Set<String> SUPPORTED_LOCALES = Set.of("en", "hi");

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
        String locale = Objects.toString(preferredLocale, "").trim().toLowerCase(Locale.ROOT);
        if (locale.contains("-")) {
            locale = locale.substring(0, locale.indexOf('-'));
        }
        if (SUPPORTED_LOCALES.contains(locale)) {
            return locale;
        }
        return DEFAULT_LOCALE;
    }

    public record ResolvedRuleMessage(String locale, String titleTemplate, String messageTemplate) {
    }
}
