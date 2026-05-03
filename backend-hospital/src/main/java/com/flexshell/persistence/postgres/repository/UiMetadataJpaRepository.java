package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.UiMetadataJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UiMetadataJpaRepository extends JpaRepository<UiMetadataJpaEntity, String> {

    Optional<UiMetadataJpaEntity> findByIdAndDeletedFalse(String id);
}
