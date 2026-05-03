package com.flexshell.persistence.api;

import com.flexshell.auth.RefreshTokenEntity;

import java.util.Optional;

/**
 * Persistence port for refresh tokens (Mongo or PostgreSQL adapter behind configuration).
 */
public interface RefreshTokenAccess {

    Optional<RefreshTokenEntity> findByToken(String token);

    RefreshTokenEntity save(RefreshTokenEntity entity);

    void delete(RefreshTokenEntity entity);
}
