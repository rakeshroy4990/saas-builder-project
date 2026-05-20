package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientDeviceReadingJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientDeviceReadingJpaRepository extends JpaRepository<PatientDeviceReadingJpaEntity, Long> {

    Page<PatientDeviceReadingJpaEntity> findByPatientUserIdAndDeletedFalse(
            String patientUserId,
            Pageable pageable
    );
}
