package com.flexshell.telemetry;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SessionTelemetryRepository extends MongoRepository<SessionTelemetryEntity, String> {
    Optional<SessionTelemetryEntity> findBySessionKey(String sessionKey);
}
