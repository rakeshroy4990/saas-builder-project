package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientDeviceReadingJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PatientDeviceReadingJpaRepository extends JpaRepository<PatientDeviceReadingJpaEntity, Long> {

    Page<PatientDeviceReadingJpaEntity> findByPatientUserIdAndDeletedFalse(
            String patientUserId,
            Pageable pageable
    );

    Optional<PatientDeviceReadingJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);
}
