package com.flexshell.controller.dto;

import java.util.List;
import java.util.UUID;

public record NotificationEventRuleResponse(
        UUID externalId,
        String eventType,
        String recipientRole,
        String entityType,
        boolean enabled,
        int sortOrder,
        List<NotificationEventRuleMessageResponse> messages
) {
}
