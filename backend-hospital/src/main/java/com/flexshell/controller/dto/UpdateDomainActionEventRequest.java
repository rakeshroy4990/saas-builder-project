package com.flexshell.controller.dto;

public class UpdateDomainActionEventRequest {
    private String eventType;
    private String contextProfile;
    private String actorRoleFilter;
    private String responseRoleField;
    private String responseRoleValue;
    private Boolean enabled;

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getContextProfile() {
        return contextProfile;
    }

    public void setContextProfile(String contextProfile) {
        this.contextProfile = contextProfile;
    }

    public String getActorRoleFilter() {
        return actorRoleFilter;
    }

    public void setActorRoleFilter(String actorRoleFilter) {
        this.actorRoleFilter = actorRoleFilter;
    }

    public String getResponseRoleField() {
        return responseRoleField;
    }

    public void setResponseRoleField(String responseRoleField) {
        this.responseRoleField = responseRoleField;
    }

    public String getResponseRoleValue() {
        return responseRoleValue;
    }

    public void setResponseRoleValue(String responseRoleValue) {
        this.responseRoleValue = responseRoleValue;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
