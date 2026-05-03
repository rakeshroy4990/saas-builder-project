package com.flexshell.compliance;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@Service
public class AuditLogService {
    private final ObjectProvider<AuditEventRepository> repositoryProvider;
    private final PhiRetentionPolicy retentionPolicy;

    public AuditLogService(ObjectProvider<AuditEventRepository> repositoryProvider, PhiRetentionPolicy retentionPolicy) {
        this.repositoryProvider = repositoryProvider;
        this.retentionPolicy = retentionPolicy;
    }

    public void log(String actorUserId, String action, String resourceType, String resourceId, Map<String, Object> metadata) {
        AuditEventRepository repository = repositoryProvider.getIfAvailable();
        if (repository == null) {
            return;
        }
        AuditEventEntity event = new AuditEventEntity();
        event.setActorUserId(normalize(actorUserId));
        event.setAction(normalize(action));
        event.setResourceType(normalize(resourceType));
        event.setResourceId(normalize(resourceId));
        event.setMetadata(metadata == null ? Map.of() : metadata);
        event.setCreatedTimestamp(Instant.now());
        event.setExpiresAt(retentionPolicy.expiresAtFromNow());
        repository.save(event);
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

