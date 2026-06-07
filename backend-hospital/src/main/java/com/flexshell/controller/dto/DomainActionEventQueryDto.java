package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DomainActionEventQueryDto {
    @JsonProperty("HttpMethod")
    private String httpMethod;
    @JsonProperty("EndpointPattern")
    private String endpointPattern;
    @JsonProperty("EventType")
    private String eventType;
    @JsonProperty("Enabled")
    private Boolean enabled;

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

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
