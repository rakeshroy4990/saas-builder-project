package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.StructuredPrescriptionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StructuredPrescriptionJpaRepository extends JpaRepository<StructuredPrescriptionJpaEntity, String> {

    Optional<StructuredPrescriptionJpaEntity> findByAppointmentIdAndDeletedFalse(String appointmentId);
}
