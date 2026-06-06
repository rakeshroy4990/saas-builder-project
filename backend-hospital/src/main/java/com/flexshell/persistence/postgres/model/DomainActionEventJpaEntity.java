package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "domain_action_events")
public class DomainActionEventJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "http_method", nullable = false, length = 16)
    private String httpMethod;

    @Column(name = "endpoint_pattern", nullable = false)
    private String endpointPattern;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "context_profile", nullable = false)
    private String contextProfile;

    @Column(name = "actor_role_filter")
    private String actorRoleFilter;

    @Column(name = "response_role_field")
    private String responseRoleField;

    @Column(name = "response_role_value")
    private String responseRoleValue;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private boolean deleted;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public UUID getExternalId() {
        return externalId;
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

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
