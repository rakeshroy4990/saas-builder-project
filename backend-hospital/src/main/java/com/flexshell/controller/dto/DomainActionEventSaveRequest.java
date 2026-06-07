package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

/**
 * Upsert body for {@code POST /api/v1/domain-action-events/save} and
 * {@code POST /api/v1/admin/domain-action-events/save}.
 * Business key: {@code ExternalId}, or {@code HttpMethod}+{@code EndpointPattern} when creating.
 */
public class DomainActionEventSaveRequest {
    @JsonProperty("ExternalId")
    private UUID externalId;
    @JsonProperty("HttpMethod")
    private String httpMethod;
    @JsonProperty("EndpointPattern")
    private String endpointPattern;
    @JsonProperty("EventType")
    private String eventType;
    @JsonProperty("ContextProfile")
    private String contextProfile;
    @JsonProperty("ActorRoleFilter")
    private String actorRoleFilter;
    @JsonProperty("ResponseRoleField")
    private String responseRoleField;
    @JsonProperty("ResponseRoleValue")
    private String responseRoleValue;
    @JsonProperty("Enabled")
    private Boolean enabled;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getHttpMethod() {
        return httpMethod;
    }

    public void setHttpMethod(String httpMethod) {
        this.httpMethod = httpMethod;
    }

    public String getEndpointPattern() {
        return endpointPattern;
    }

    public void setEndpointPattern(String endpointPattern) {
        this.endpointPattern = endpointPattern;
    }

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
