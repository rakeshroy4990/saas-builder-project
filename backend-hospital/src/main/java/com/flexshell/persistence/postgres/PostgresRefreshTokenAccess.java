package com.flexshell.persistence.postgres;

import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.persistence.RefreshTokenEntityMapper;
import com.flexshell.persistence.api.RefreshTokenAccess;
import com.flexshell.persistence.postgres.model.RefreshTokenJpaEntity;
import com.flexshell.persistence.postgres.repository.RefreshTokenJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresRefreshTokenAccess implements RefreshTokenAccess {

    private final RefreshTokenJpaRepository repository;

    public PostgresRefreshTokenAccess(RefreshTokenJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<RefreshTokenEntity> findByToken(String token) {
        return repository.findByTokenAndDeletedFalse(token).map(RefreshTokenEntityMapper::fromJpa);
    }

    @Override
    public RefreshTokenEntity save(RefreshTokenEntity entity) {
        RefreshTokenJpaEntity row = RefreshTokenEntityMapper.toJpa(entity);
        if (row.getId() == null || row.getId().isBlank()) {
            row.setId(UUID.randomUUID().toString());
        }
        RefreshTokenJpaEntity saved = repository.save(row);
        return RefreshTokenEntityMapper.fromJpa(saved);
    }

    @Override
    public void delete(RefreshTokenEntity entity) {
        if (entity.getId() != null && !entity.getId().isBlank()) {
            repository.deleteById(entity.getId());
        }
    }
}
