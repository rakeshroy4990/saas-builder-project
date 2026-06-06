package com.flexshell.controller.dto;

import java.util.List;

public class UpdateNotificationRuleRequest {
    private Boolean enabled;
    private Integer sortOrder;
    private String entityType;
    private List<NotificationEventRuleMessageRequest> messages;

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

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public List<NotificationEventRuleMessageRequest> getMessages() {
        return messages;
    }

    public void setMessages(List<NotificationEventRuleMessageRequest> messages) {
        this.messages = messages;
    }
}
