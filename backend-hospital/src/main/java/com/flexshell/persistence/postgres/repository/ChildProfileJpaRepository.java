package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.ChildProfileJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ChildProfileJpaRepository extends JpaRepository<ChildProfileJpaEntity, Long> {

    Optional<ChildProfileJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Page<ChildProfileJpaEntity> findByPatientUserIdAndDeletedFalse(String patientUserId, Pageable pageable);

    Page<ChildProfileJpaEntity> findByPatientUserIdAndDisplayNameContainingIgnoreCaseAndDeletedFalse(
            String patientUserId,
            String displayName,
            Pageable pageable
    );
}
