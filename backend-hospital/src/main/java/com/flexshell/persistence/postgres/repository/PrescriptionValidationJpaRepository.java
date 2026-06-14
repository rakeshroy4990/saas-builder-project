package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PrescriptionValidationJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrescriptionValidationJpaRepository extends JpaRepository<PrescriptionValidationJpaEntity, Long> {

    Optional<PrescriptionValidationJpaEntity> findFirstByPatientPrescriptionExternalIdOrderByCreatedAtDesc(
            UUID patientPrescriptionExternalId
    );

    Optional<PrescriptionValidationJpaEntity> findFirstByStructuredPrescriptionExternalIdOrderByCreatedAtDesc(
            UUID structuredPrescriptionExternalId
    );

    List<PrescriptionValidationJpaEntity> findByPatientPrescriptionExternalIdInOrderByCreatedAtDesc(
            List<UUID> patientPrescriptionExternalIds
    );
}
