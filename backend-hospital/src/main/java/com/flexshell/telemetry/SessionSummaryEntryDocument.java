package com.flexshell.telemetry;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.Map;

/**
 * Embedded document stored under {@link SessionTelemetryEntity#getSessionSummary()}.
 */
public class SessionSummaryEntryDocument {
    @Field("EntryId")
    @JsonProperty("EntryId")
    @JsonAlias({"entryId"})
    private String entryId;

    @Field("OccurredAt")
    @JsonProperty("OccurredAt")
    @JsonAlias({"occurredAt"})
    private String occurredAt;

    @Field("Kind")
    @JsonProperty("Kind")
    @JsonAlias({"kind"})
    private String kind;

    @Field("PageId")
    @JsonProperty("PageId")
    @JsonAlias({"pageId"})
    private String pageId;

    @Field("PackageName")
    @JsonProperty("PackageName")
    @JsonAlias({"packageName"})
    private String packageName;

    @Field("ComponentId")
    @JsonProperty("ComponentId")
    @JsonAlias({"componentId"})
    private String componentId;

    @Field("PopupPageId")
    @JsonProperty("PopupPageId")
    @JsonAlias({"popupPageId"})
    private String popupPageId;

    @Field("RoutePath")
    @JsonProperty("RoutePath")
    @JsonAlias({"routePath"})
    private String routePath;

    @Field("ApiPath")
    @JsonProperty("ApiPath")
    @JsonAlias({"apiPath"})
    private String apiPath;

    @Field("HttpMethod")
    @JsonProperty("HttpMethod")
    @JsonAlias({"httpMethod"})
    private String httpMethod;

    @Field("HttpStatus")
    @JsonProperty("HttpStatus")
    @JsonAlias({"httpStatus"})
    private Integer httpStatus;

    @Field("DurationMs")
    @JsonProperty("DurationMs")
    @JsonAlias({"durationMs"})
    private Integer durationMs;

    @Field("ErrorMessage")
    @JsonProperty("ErrorMessage")
    @JsonAlias({"errorMessage"})
    private String errorMessage;

    @Field("ReasonCode")
    @JsonProperty("ReasonCode")
    @JsonAlias({"reasonCode"})
    private String reasonCode;

    @Field("ActionAlias")
    @JsonProperty("ActionAlias")
    @JsonAlias({"actionAlias"})
    private String actionAlias;

    @Field("ActionId")
    @JsonProperty("ActionId")
    @JsonAlias({"actionId"})
    private String actionId;

    @Field("UserEmail")
    @JsonProperty("UserEmail")
    @JsonAlias({"userEmail"})
    private String userEmail;

    @Field("Attributes")
    @JsonProperty("Attributes")
    @JsonAlias({"attributes"})
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
