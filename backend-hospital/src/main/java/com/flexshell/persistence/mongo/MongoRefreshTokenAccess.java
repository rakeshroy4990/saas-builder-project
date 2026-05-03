package com.flexshell.persistence.mongo;

import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.auth.RefreshTokenRepository;
import com.flexshell.persistence.api.RefreshTokenAccess;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.mongo.enabled", havingValue = "true")
public class MongoRefreshTokenAccess implements RefreshTokenAccess {

    private final RefreshTokenRepository repository;

    public MongoRefreshTokenAccess(RefreshTokenRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<RefreshTokenEntity> findByToken(String token) {
        return repository.findByToken(token);
    }

    @Override
    public RefreshTokenEntity save(RefreshTokenEntity entity) {
        return repository.save(entity);
    }

    @Override
    public void delete(RefreshTokenEntity entity) {
        repository.delete(entity);
    }
}
