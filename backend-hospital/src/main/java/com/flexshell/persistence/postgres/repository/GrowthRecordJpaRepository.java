package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.GrowthRecordJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GrowthRecordJpaRepository extends JpaRepository<GrowthRecordJpaEntity, Long> {

    Optional<GrowthRecordJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Page<GrowthRecordJpaEntity> findByChildProfileExternalIdAndDeletedFalse(
            UUID childProfileExternalId,
            Pageable pageable
    );

    List<GrowthRecordJpaEntity> findByChildProfileExternalIdAndDeletedFalseOrderByRecordedAtAsc(
            UUID childProfileExternalId
    );
}
