package com.flexshell.appointment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AppointmentRepository extends MongoRepository<AppointmentEntity, String> {
    Page<AppointmentEntity> findByCreatedBy(String createdBy, Pageable pageable);
    Page<AppointmentEntity> findByDoctorId(String doctorId, Pageable pageable);

    List<AppointmentEntity> findByDoctorIdAndPreferredDate(String doctorId, String preferredDate);
}
