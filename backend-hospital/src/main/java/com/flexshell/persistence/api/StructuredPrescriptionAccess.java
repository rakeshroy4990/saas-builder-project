package com.flexshell.persistence.api;

import com.flexshell.prescription.StructuredPrescriptionEntity;

import java.util.Optional;

/**
 * Persistence port for {@link StructuredPrescriptionEntity} (Mongo or Postgres).
 */
public interface StructuredPrescriptionAccess {

    Optional<StructuredPrescriptionEntity> findByAppointmentId(String appointmentId);

    StructuredPrescriptionEntity save(StructuredPrescriptionEntity entity);
}
