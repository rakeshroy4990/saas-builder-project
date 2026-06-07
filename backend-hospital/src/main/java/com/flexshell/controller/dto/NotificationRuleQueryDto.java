package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class NotificationRuleQueryDto {
    @JsonProperty("EventType")
    private String eventType;
    @JsonProperty("RecipientRole")
    private String recipientRole;
    @JsonProperty("Enabled")
    private Boolean enabled;

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

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
