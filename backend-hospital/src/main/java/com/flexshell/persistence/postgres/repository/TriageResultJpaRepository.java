package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.TriageResultJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface TriageResultJpaRepository extends JpaRepository<TriageResultJpaEntity, Long> {

    Optional<TriageResultJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Page<TriageResultJpaEntity> findByPatientUserIdAndDeletedFalse(String patientUserId, Pageable pageable);

    Optional<TriageResultJpaEntity> findFirstByAppointmentExternalIdAndDeletedFalseOrderByCreatedAtDesc(
            UUID appointmentExternalId
    );

    Optional<TriageResultJpaEntity> findFirstByPatientUserIdAndCreatedAtAfterAndDeletedFalseOrderByCreatedAtDesc(
            String patientUserId,
            Instant createdAfter
    );
}
