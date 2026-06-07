package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.UUID;

/**
 * Upsert body for {@code POST /api/v1/notification-rules/save} and
 * {@code POST /api/v1/admin/notification-rules/save}.
 * Business key: {@code ExternalId}, or {@code EventType}+{@code RecipientRole} when creating.
 */
public class NotificationRuleSaveRequest {
    @JsonProperty("ExternalId")
    private UUID externalId;
    @JsonProperty("EventType")
    private String eventType;
    @JsonProperty("RecipientRole")
    private String recipientRole;
    @JsonProperty("EntityType")
    private String entityType;
    @JsonProperty("Enabled")
    private Boolean enabled;
    @JsonProperty("SortOrder")
    private Integer sortOrder;
    @JsonProperty("Messages")
    private List<NotificationEventRuleMessageRequest> messages;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getRecipientRole() {
        return recipientRole;
    }

    public void setRecipientRole(String recipientRole) {
        this.recipientRole = recipientRole;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public List<NotificationEventRuleMessageRequest> getMessages() {
        return messages;
    }

    public void setMessages(List<NotificationEventRuleMessageRequest> messages) {
        this.messages = messages;
    }
}
