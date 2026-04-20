package com.flexshell.prescription;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface StructuredPrescriptionRepository extends MongoRepository<StructuredPrescriptionEntity, String> {
    Optional<StructuredPrescriptionEntity> findByAppointmentId(String appointmentId);
}
