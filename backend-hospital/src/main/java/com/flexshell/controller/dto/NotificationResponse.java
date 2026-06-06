package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        @JsonProperty("ExternalId") UUID externalId,
        @JsonProperty("EventType") String eventType,
        @JsonProperty("Title") String title,
        @JsonProperty("Message") String message,
        @JsonProperty("EntityType") String entityType,
        @JsonProperty("EntityExternalId") UUID entityExternalId,
        @JsonProperty("EntityRefId") String entityRefId,
        @JsonProperty("IsRead") boolean isRead,
        @JsonProperty("CreatedAt") Instant createdAt
) {
}
