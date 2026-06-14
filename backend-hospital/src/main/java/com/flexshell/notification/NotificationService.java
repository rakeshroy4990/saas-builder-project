package com.flexshell.notification;

import com.flexshell.persistence.postgres.model.NotificationJpaEntity;
import com.flexshell.persistence.postgres.model.NotificationEventRuleJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.NotificationJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import com.flexshell.controller.dto.NotificationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class NotificationService {

    private static final Logger LOG = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRuleCatalog ruleCatalog;
    private final NotificationJpaRepository notificationRepository;
    private final UserJpaRepository userRepository;
    private final AppointmentJpaRepository appointmentRepository;
    private final NotificationWsPublisher wsPublisher;

    public NotificationService(
            NotificationRuleCatalog ruleCatalog,
            NotificationJpaRepository notificationRepository,
            UserJpaRepository userRepository,
            AppointmentJpaRepository appointmentRepository,
            NotificationWsPublisher wsPublisher
    ) {
        this.ruleCatalog = ruleCatalog;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.wsPublisher = wsPublisher;
    }

    @Transactional
    public void triggerEvent(String eventType, String triggeredByUserId, Map<String, Object> context) {
        if (eventType == null || eventType.isBlank()) {
            return;
        }
        List<NotificationEventRuleJpaEntity> rules = ruleCatalog.findEnabledRulesForEvent(eventType);
        if (rules.isEmpty()) {
            return;
        }

        Map<String, String> vars = toStringMap(context);
        UUID entityExternalId = resolveEntityExternalId(context);

        for (NotificationEventRuleJpaEntity rule : rules) {
            List<String> recipientIds = resolveRecipients(rule.getRecipientRole(), context);
            for (String recipientId : recipientIds) {
                if (recipientId == null || recipientId.isBlank()) {
                    continue;
                }
                try {
                    String locale = resolveRecipientLocale(recipientId);
                    NotificationRuleCatalog.ResolvedRuleMessage templates = ruleCatalog.resolveMessage(rule, locale);
                    NotificationJpaEntity row = new NotificationJpaEntity();
                    row.setRecipientUserId(recipientId.trim());
                    row.setRecipientRole(normalizeRole(rule.getRecipientRole()));
                    row.setEventType(rule.getEventType());
                    row.setTitle(NotificationTemplateResolver.resolveTemplate(templates.titleTemplate(), vars));
                    row.setMessage(NotificationTemplateResolver.resolveTemplate(templates.messageTemplate(), vars));
                    row.setEntityType(blankToNull(rule.getEntityType()));
                    row.setEntityExternalId(entityExternalId);
                    row.setEntityRefId(resolveEntityRefId(context));
                    row.setRead(false);
                    row.setCreatedByUserId(trimToNull(triggeredByUserId));
                    row.setDeleted(false);

                    NotificationJpaEntity saved = notificationRepository.save(row);
                    NotificationResponse response = toResponse(saved);
                    long unreadCount = getUnreadCount(recipientId);
                    try {
                        wsPublisher.publishToUser(recipientId, response, unreadCount);
                    } catch (Exception ex) {
                        LOG.warn("notification_ws_publish_failed eventType={} recipientUserId={}",
                                eventType, recipientId, ex);
                    }
                } catch (Exception ex) {
                    LOG.warn("notification_rule_apply_failed eventType={} role={} recipientUserId={}",
                            eventType, rule.getRecipientRole(), recipientId, ex);
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> listForUser(String userId, boolean unreadOnly, Pageable pageable) {
        String actor = normalizeUserId(userId);
        Page<NotificationJpaEntity> page = unreadOnly
                ? notificationRepository.findByRecipientUserIdAndReadFalseAndDeletedFalseOrderByCreatedAtDesc(actor, pageable)
                : notificationRepository.findByRecipientUserIdAndDeletedFalseOrderByCreatedAtDesc(actor, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(String userId) {
        return notificationRepository.countByRecipientUserIdAndReadFalseAndDeletedFalse(normalizeUserId(userId));
    }

    @Transactional
    public void markAsRead(UUID externalId, String userId) {
        NotificationJpaEntity row = notificationRepository
                .findByExternalIdAndRecipientUserIdAndDeletedFalse(externalId, normalizeUserId(userId))
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        if (!row.isRead()) {
            row.setRead(true);
            row.setReadAt(Instant.now());
            notificationRepository.save(row);
        }
    }

    @Transactional
    public void markAllAsRead(String userId) {
        notificationRepository.markAllReadForUser(normalizeUserId(userId), Instant.now());
    }

    private String resolveRecipientLocale(String recipientUserId) {
        return userRepository.findById(normalizeUserId(recipientUserId))
                .map(UserJpaEntity::getPreferredLocale)
                .map(NotificationRuleCatalog::normalizeLocale)
                .orElse(NotificationRuleCatalog.normalizeLocale(null));
    }

    private List<String> resolveRecipients(String role, Map<String, Object> context) {
        String normalizedRole = normalizeRole(role);
        return switch (normalizedRole) {
            case "DOCTOR" -> singleRecipient(context.get("doctorId"));
            case "PATIENT" -> singleRecipient(context.get("patientId"));
            case "ADMIN" -> userRepository.findActiveUserIdsByRole(com.flexshell.auth.UserRole.ADMIN);
            default -> List.of();
        };
    }

    private static List<String> singleRecipient(Object userId) {
        String id = Objects.toString(userId, "").trim();
        return id.isBlank() ? List.of() : List.of(id);
    }

    private UUID resolveEntityExternalId(Map<String, Object> context) {
        Object direct = context.get("appointmentExternalId");
        if (direct == null) {
            direct = context.get("entityExternalId");
        }
        UUID parsed = parseUuid(direct);
        if (parsed != null) {
            return parsed;
        }
        String appointmentId = Objects.toString(context.get("appointmentId"), "").trim();
        if (appointmentId.isBlank()) {
            return null;
        }
        return appointmentRepository.findById(appointmentId)
                .filter(row -> !row.isDeleted())
                .map(row -> row.getExternalId())
                .orElse(null);
    }

    private static String resolveEntityRefId(Map<String, Object> context) {
        String appointmentId = Objects.toString(context.get("appointmentId"), "").trim();
        if (!appointmentId.isBlank()) {
            return appointmentId;
        }
        return trimToNull(Objects.toString(context.get("entityRefId"), ""));
    }

    private static Map<String, String> toStringMap(Map<String, Object> context) {
        Map<String, String> vars = new LinkedHashMap<>();
        if (context == null) {
            return vars;
        }
        for (Map.Entry<String, Object> entry : context.entrySet()) {
            vars.put(entry.getKey(), Objects.toString(entry.getValue(), ""));
        }
        return vars;
    }

    private NotificationResponse toResponse(NotificationJpaEntity row) {
        return new NotificationResponse(
                row.getExternalId(),
                row.getEventType(),
                row.getTitle(),
                row.getMessage(),
                row.getEntityType(),
                row.getEntityExternalId(),
                row.getEntityRefId(),
                row.isRead(),
                row.getCreatedAt()
        );
    }

    private static UUID parseUuid(Object value) {
        if (value instanceof UUID uuid) {
            return uuid;
        }
        String text = Objects.toString(value, "").trim();
        if (text.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String normalizeUserId(String userId) {
        return Objects.toString(userId, "").trim();
    }

    private static String normalizeRole(String role) {
        return Objects.toString(role, "").trim().toUpperCase();
    }

    private static String trimToNull(String value) {
        String trimmed = Objects.toString(value, "").trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private static String blankToNull(String value) {
        String trimmed = Objects.toString(value, "").trim();
        if (trimmed.isBlank() || "null".equalsIgnoreCase(trimmed)) {
            return null;
        }
        return trimmed;
    }
}
