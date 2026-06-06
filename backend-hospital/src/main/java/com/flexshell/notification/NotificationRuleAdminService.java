package com.flexshell.notification;

import com.flexshell.controller.dto.CreateNotificationRuleRequest;
import com.flexshell.controller.dto.NotificationEventRuleMessageRequest;
import com.flexshell.controller.dto.NotificationEventRuleMessageResponse;
import com.flexshell.controller.dto.NotificationEventRuleResponse;
import com.flexshell.controller.dto.UpdateNotificationRuleRequest;
import com.flexshell.persistence.postgres.model.NotificationEventRuleJpaEntity;
import com.flexshell.persistence.postgres.model.NotificationEventRuleMessageJpaEntity;
import com.flexshell.persistence.postgres.repository.NotificationEventRuleJpaRepository;
import com.flexshell.persistence.postgres.repository.NotificationEventRuleMessageJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class NotificationRuleAdminService {

    private static final Set<String> ALLOWED_ROLES = Set.of("DOCTOR", "PATIENT", "ADMIN");

    private final NotificationRuleCatalog ruleCatalog;
    private final NotificationEventRuleJpaRepository ruleRepository;
    private final NotificationEventRuleMessageJpaRepository messageRepository;

    public NotificationRuleAdminService(
            NotificationRuleCatalog ruleCatalog,
            NotificationEventRuleJpaRepository ruleRepository,
            NotificationEventRuleMessageJpaRepository messageRepository
    ) {
        this.ruleCatalog = ruleCatalog;
        this.ruleRepository = ruleRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationEventRuleResponse> listRules() {
        return ruleCatalog.listAllRules().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public NotificationEventRuleResponse createRule(CreateNotificationRuleRequest request) {
        String eventType = requireText(request.getEventType(), "eventType").toUpperCase(Locale.ROOT);
        String recipientRole = normalizeRole(request.getRecipientRole());
        validateRole(recipientRole);

        ruleRepository.findByEventTypeIgnoreCaseAndRecipientRoleIgnoreCaseAndDeletedFalse(eventType, recipientRole)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException(
                            "Notification rule already exists for eventType="
                                    + eventType
                                    + " recipientRole="
                                    + recipientRole
                    );
                });

        NotificationEventRuleJpaEntity rule = new NotificationEventRuleJpaEntity();
        rule.setEventType(eventType);
        rule.setRecipientRole(recipientRole);
        rule.setEntityType(blankToNull(request.getEntityType()));
        rule.setEnabled(request.getEnabled() == null || request.getEnabled());
        rule.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        rule.setDeleted(false);

        NotificationEventRuleJpaEntity savedRule = ruleRepository.save(rule);
        upsertMessages(savedRule.getId(), request.getMessages(), true);
        return toResponse(savedRule);
    }

    @Transactional
    public NotificationEventRuleResponse updateRule(UUID externalId, UpdateNotificationRuleRequest request) {
        NotificationEventRuleJpaEntity rule = findRule(externalId);

        if (request.getEnabled() != null) {
            rule.setEnabled(request.getEnabled());
        }
        if (request.getSortOrder() != null) {
            rule.setSortOrder(request.getSortOrder());
        }
        if (request.getEntityType() != null) {
            rule.setEntityType(blankToNull(request.getEntityType()));
        }

        NotificationEventRuleJpaEntity savedRule = ruleRepository.save(rule);
        if (request.getMessages() != null && !request.getMessages().isEmpty()) {
            upsertMessages(savedRule.getId(), request.getMessages(), false);
        }
        return toResponse(savedRule);
    }

    @Transactional
    public void deleteRule(UUID externalId) {
        NotificationEventRuleJpaEntity rule = findRule(externalId);
        rule.setDeleted(true);
        ruleRepository.save(rule);

        for (NotificationEventRuleMessageJpaEntity message : messageRepository.findByRuleIdAndDeletedFalseOrderByLocaleAsc(
                rule.getId()
        )) {
            message.setDeleted(true);
            messageRepository.save(message);
        }
    }

    private void upsertMessages(
            Long ruleId,
            List<NotificationEventRuleMessageRequest> messages,
            boolean required
    ) {
        if (messages == null || messages.isEmpty()) {
            if (required) {
                throw new IllegalArgumentException("At least one message template is required");
            }
            return;
        }

        Map<String, NotificationEventRuleMessageRequest> byLocale = new LinkedHashMap<>();
        for (NotificationEventRuleMessageRequest message : messages) {
            String locale = NotificationRuleCatalog.normalizeLocale(message.getLocale());
            if (byLocale.containsKey(locale)) {
                throw new IllegalArgumentException("Duplicate locale in messages: " + locale);
            }
            byLocale.put(locale, message);
        }

        for (Map.Entry<String, NotificationEventRuleMessageRequest> entry : byLocale.entrySet()) {
            NotificationEventRuleMessageRequest messageRequest = entry.getValue();
            String titleTemplate = requireText(messageRequest.getTitleTemplate(), "titleTemplate");
            String messageTemplate = requireText(messageRequest.getMessageTemplate(), "messageTemplate");

            NotificationEventRuleMessageJpaEntity message = messageRepository
                    .findByRuleIdAndLocaleIgnoreCaseAndDeletedFalse(ruleId, entry.getKey())
                    .orElseGet(() -> {
                        NotificationEventRuleMessageJpaEntity row = new NotificationEventRuleMessageJpaEntity();
                        row.setRuleId(ruleId);
                        row.setLocale(entry.getKey());
                        row.setDeleted(false);
                        return row;
                    });
            message.setTitleTemplate(titleTemplate);
            message.setMessageTemplate(messageTemplate);
            messageRepository.save(message);
        }
    }

    private NotificationEventRuleJpaEntity findRule(UUID externalId) {
        if (externalId == null) {
            throw new IllegalArgumentException("Rule external id is required");
        }
        return ruleRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("Notification rule not found"));
    }

    private NotificationEventRuleResponse toResponse(NotificationEventRuleJpaEntity rule) {
        List<NotificationEventRuleMessageResponse> messages = ruleCatalog.listMessagesForRule(rule.getId()).stream()
                .map(this::toMessageResponse)
                .toList();
        return new NotificationEventRuleResponse(
                rule.getExternalId(),
                rule.getEventType(),
                rule.getRecipientRole(),
                rule.getEntityType(),
                rule.isEnabled(),
                rule.getSortOrder(),
                messages
        );
    }

    private NotificationEventRuleMessageResponse toMessageResponse(NotificationEventRuleMessageJpaEntity message) {
        return new NotificationEventRuleMessageResponse(
                message.getLocale(),
                message.getTitleTemplate(),
                message.getMessageTemplate()
        );
    }

    private static void validateRole(String recipientRole) {
        if (!ALLOWED_ROLES.contains(recipientRole)) {
            throw new IllegalArgumentException(
                    "recipientRole must be one of: DOCTOR, PATIENT, ADMIN"
            );
        }
    }

    private static String normalizeRole(String role) {
        return requireText(role, "recipientRole").toUpperCase(Locale.ROOT);
    }

    private static String requireText(String value, String fieldName) {
        String trimmed = Objects.toString(value, "").trim();
        if (trimmed.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return trimmed;
    }

    private static String blankToNull(String value) {
        String trimmed = Objects.toString(value, "").trim();
        if (trimmed.isBlank() || "null".equalsIgnoreCase(trimmed)) {
            return null;
        }
        return trimmed;
    }
}
