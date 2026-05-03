package com.flexshell.persistence.mongo;

import com.flexshell.persistence.api.SessionTelemetryAccess;
import com.flexshell.telemetry.SessionTelemetryEntity;
import com.flexshell.telemetry.SessionTelemetryRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.mongo.enabled", havingValue = "true")
@ConditionalOnBean(SessionTelemetryRepository.class)
public class MongoSessionTelemetryAccess implements SessionTelemetryAccess {

    private final SessionTelemetryRepository delegate;

    public MongoSessionTelemetryAccess(SessionTelemetryRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Optional<SessionTelemetryEntity> findTopBySessionKeyOrderByUpdatedAtDesc(String sessionKey) {
        return delegate.findTop1BySessionKeyOrderByUpdatedAtDesc(sessionKey);
    }

    @Override
    public Optional<SessionTelemetryEntity> findTopByTraceIdOrderByUpdatedAtDesc(String traceId) {
        return delegate.findTop1ByTraceIdOrderByUpdatedAtDesc(traceId);
    }

    @Override
    public SessionTelemetryEntity save(SessionTelemetryEntity entity) {
        return delegate.save(entity);
    }
}
