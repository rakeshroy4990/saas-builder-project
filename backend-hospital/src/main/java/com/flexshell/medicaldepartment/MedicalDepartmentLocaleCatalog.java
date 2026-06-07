package com.flexshell.medicaldepartment;

import com.flexshell.auth.i18n.SupportedLocale;
import com.flexshell.controller.dto.MedicalDepartmentMessageRequest;
import com.flexshell.persistence.postgres.model.MedicalDepartmentMessageJpaEntity;
import com.flexshell.persistence.postgres.repository.MedicalDepartmentMessageJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class MedicalDepartmentLocaleCatalog {

    private final MedicalDepartmentMessageJpaRepository messageRepository;

    public MedicalDepartmentLocaleCatalog(MedicalDepartmentMessageJpaRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    @Transactional
    public void upsertMessages(String departmentId, List<MedicalDepartmentMessageRequest> messages) {
        if (departmentId == null || departmentId.isBlank()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_LOCALE_ID_REQUIRED");
        }
        if (messages == null || messages.isEmpty()) {
            return;
        }

        Map<String, MedicalDepartmentMessageRequest> byLocale = new LinkedHashMap<>();
        for (MedicalDepartmentMessageRequest message : messages) {
            String locale = SupportedLocale.normalize(message.getLocale());
            if (byLocale.containsKey(locale)) {
                throw new IllegalArgumentException("MEDICAL_DEPARTMENT_DUPLICATE_LOCALE");
            }
            byLocale.put(locale, message);
        }

        for (Map.Entry<String, MedicalDepartmentMessageRequest> entry : byLocale.entrySet()) {
            MedicalDepartmentMessageRequest messageRequest = entry.getValue();
            String name = requireText(messageRequest.getName(), "Messages.Name");
            String description = normalizeOptional(messageRequest.getDescription());

            MedicalDepartmentMessageJpaEntity row = messageRepository
                    .findByDepartmentIdAndLocaleIgnoreCaseAndDeletedFalse(departmentId, entry.getKey())
                    .orElseGet(() -> {
                        MedicalDepartmentMessageJpaEntity created = new MedicalDepartmentMessageJpaEntity();
                        created.setDepartmentId(departmentId);
                        created.setLocale(entry.getKey());
                        created.setDeleted(false);
                        return created;
                    });
            row.setName(name);
            row.setDescription(description);
            messageRepository.save(row);
        }
    }

    @Transactional(readOnly = true)
    public ResolvedCopy resolve(
            String departmentId,
            String preferredLocale,
            String fallbackName,
            String fallbackDescription
    ) {
        String locale = SupportedLocale.normalize(preferredLocale);
        if (departmentId != null && !departmentId.isBlank()) {
            MedicalDepartmentMessageJpaEntity message = messageRepository
                    .findByDepartmentIdAndLocaleIgnoreCaseAndDeletedFalse(departmentId, locale)
                    .or(() -> messageRepository.findByDepartmentIdAndLocaleIgnoreCaseAndDeletedFalse(
                            departmentId,
                            SupportedLocale.DEFAULT
                    ))
                    .orElse(null);
            if (message != null) {
                return new ResolvedCopy(
                        SupportedLocale.normalize(message.getLocale()),
                        message.getName(),
                        message.getDescription()
                );
            }
        }
        return new ResolvedCopy(SupportedLocale.DEFAULT, fallbackName, fallbackDescription);
    }

    @Transactional(readOnly = true)
    public MedicalDepartmentMessageRequest englishMessageOrNull(String departmentId) {
        if (departmentId == null || departmentId.isBlank()) {
            return null;
        }
        return messageRepository
                .findByDepartmentIdAndLocaleIgnoreCaseAndDeletedFalse(departmentId, SupportedLocale.DEFAULT)
                .map(row -> {
                    MedicalDepartmentMessageRequest message = new MedicalDepartmentMessageRequest();
                    message.setLocale(SupportedLocale.DEFAULT);
                    message.setName(row.getName());
                    message.setDescription(row.getDescription());
                    return message;
                })
                .orElse(null);
    }

    public static List<MedicalDepartmentMessageRequest> effectiveMessages(MedicalDepartmentRequestLike request) {
        if (request.getMessages() != null && !request.getMessages().isEmpty()) {
            return new ArrayList<>(request.getMessages());
        }
        String name = normalizeOptional(request.getName());
        if (name.isBlank()) {
            return List.of();
        }
        MedicalDepartmentMessageRequest en = new MedicalDepartmentMessageRequest();
        en.setLocale(SupportedLocale.DEFAULT);
        en.setName(name);
        en.setDescription(normalizeOptional(request.getDescription()));
        return List.of(en);
    }

    public static String primaryNameFromMessages(List<MedicalDepartmentMessageRequest> messages, String fallbackName) {
        if (messages == null || messages.isEmpty()) {
            return fallbackName;
        }
        for (MedicalDepartmentMessageRequest message : messages) {
            if (SupportedLocale.DEFAULT.equals(SupportedLocale.normalize(message.getLocale()))) {
                String name = normalizeOptional(message.getName());
                if (!name.isBlank()) {
                    return name;
                }
            }
        }
        String first = normalizeOptional(messages.get(0).getName());
        return first.isBlank() ? fallbackName : first;
    }

    public static String primaryDescriptionFromMessages(
            List<MedicalDepartmentMessageRequest> messages,
            String fallbackDescription
    ) {
        if (messages == null || messages.isEmpty()) {
            return fallbackDescription;
        }
        for (MedicalDepartmentMessageRequest message : messages) {
            if (SupportedLocale.DEFAULT.equals(SupportedLocale.normalize(message.getLocale()))) {
                return normalizeOptional(message.getDescription());
            }
        }
        return normalizeOptional(messages.get(0).getDescription());
    }

    private static String requireText(String value, String field) {
        String normalized = normalizeOptional(value);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_FIELD_REQUIRED");
        }
        return normalized;
    }

    private static String normalizeOptional(String value) {
        return value == null ? "" : value.trim();
    }

    public record ResolvedCopy(String locale, String name, String description) {
    }

    /** Minimal shape for {@link #effectiveMessages} without coupling to the web DTO. */
    public interface MedicalDepartmentRequestLike {
        String getName();

        String getDescription();

        List<MedicalDepartmentMessageRequest> getMessages();
    }
}
