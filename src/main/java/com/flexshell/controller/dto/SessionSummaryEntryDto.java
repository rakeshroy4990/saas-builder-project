package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * One row in {@code sessionSummary}: client-generated {@link #entryId} ties the event to UI config
 * (page id, component id, popup page id) for traceability.
 * <p>
 * Add new cross-cutting fields here when needed; for lightweight extensions without schema churn,
 * use {@link #attributes}.
 */
public class SessionSummaryEntryDto {
    @JsonProperty("entry_id")
    private String entryId;

    @JsonProperty("occurred_at")
    private String occurredAt;

    @JsonProperty("kind")
    private String kind;

    @JsonProperty("page_id")
    private String pageId;

    @JsonProperty("package_name")
    private String packageName;

    @JsonProperty("component_id")
    private String componentId;

    @JsonProperty("popup_page_id")
    private String popupPageId;

    @JsonProperty("route_path")
    private String routePath;

    @JsonProperty("api_path")
    private String apiPath;

    @JsonProperty("http_method")
    private String httpMethod;

    @JsonProperty("http_status")
    private Integer httpStatus;

    @JsonProperty("duration_ms")
    private Integer durationMs;

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("reason_code")
    private String reasonCode;

    @JsonProperty("action_alias")
    private String actionAlias;

    @JsonProperty("action_id")
    private String actionId;

    @JsonProperty("user_email")
    private String userEmail;

    /**
     * Open-ended key/value payload for new event types without changing the DTO contract.
     */
    @JsonProperty("attributes")
    private Map<String, Object> attributes;

    public String getEntryId() {
        return entryId;
    }

    public void setEntryId(String entryId) {
        this.entryId = entryId;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(String occurredAt) {
        this.occurredAt = occurredAt;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getPageId() {
        return pageId;
    }

    public void setPageId(String pageId) {
        this.pageId = pageId;
    }

    public String getPackageName() {
        return packageName;
    }

    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }

    public String getComponentId() {
        return componentId;
    }

    public void setComponentId(String componentId) {
        this.componentId = componentId;
    }

    public String getPopupPageId() {
        return popupPageId;
    }

    public void setPopupPageId(String popupPageId) {
        this.popupPageId = popupPageId;
    }

    public String getRoutePath() {
        return routePath;
    }

    public void setRoutePath(String routePath) {
        this.routePath = routePath;
    }

    public String getApiPath() {
        return apiPath;
    }

    public void setApiPath(String apiPath) {
        this.apiPath = apiPath;
    }

    public String getHttpMethod() {
        return httpMethod;
    }

    public void setHttpMethod(String httpMethod) {
        this.httpMethod = httpMethod;
    }

    public Integer getHttpStatus() {
        return httpStatus;
    }

    public void setHttpStatus(Integer httpStatus) {
        this.httpStatus = httpStatus;
    }

    public Integer getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Integer durationMs) {
        this.durationMs = durationMs;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public String getActionAlias() {
        return actionAlias;
    }

    public void setActionAlias(String actionAlias) {
        this.actionAlias = actionAlias;
    }

    public String getActionId() {
        return actionId;
    }

    public void setActionId(String actionId) {
        this.actionId = actionId;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }
}
