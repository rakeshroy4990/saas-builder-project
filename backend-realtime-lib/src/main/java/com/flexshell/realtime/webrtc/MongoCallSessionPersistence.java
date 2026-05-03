package com.flexshell.realtime.webrtc;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@ConditionalOnBean(CallSessionRepository.class)
public class MongoCallSessionPersistence implements CallSessionPersistence {

    private final CallSessionRepository repository;

    public MongoCallSessionPersistence(CallSessionRepository repository) {
        this.repository = repository;
    }

    @Override
    public CallSessionEntity save(CallSessionEntity entity) {
        return repository.save(entity);
    }

    @Override
    public Optional<CallSessionEntity> findById(String callId) {
        return repository.findById(callId);
    }
}
