package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.RefreshTokenJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenJpaRepository extends JpaRepository<RefreshTokenJpaEntity, String> {

    Optional<RefreshTokenJpaEntity> findByTokenAndDeletedFalse(String token);
}
