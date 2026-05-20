package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientPrescriptionGroupJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientPrescriptionGroupJpaRepository extends JpaRepository<PatientPrescriptionGroupJpaEntity, String> {

    Optional<PatientPrescriptionGroupJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    List<PatientPrescriptionGroupJpaEntity> findByPatientUserIdAndGroupTypeAndDeletedFalseOrderByCreatedAtDesc(
            String patientUserId,
            String groupType
    );
}
