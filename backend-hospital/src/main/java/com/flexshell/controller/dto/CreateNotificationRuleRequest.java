package com.flexshell.controller.dto;

import java.util.List;

public class CreateNotificationRuleRequest {
    private String eventType;
    private String recipientRole;
    private String entityType;
    private Boolean enabled;
    private Integer sortOrder;
    private List<NotificationEventRuleMessageRequest> messages;

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
