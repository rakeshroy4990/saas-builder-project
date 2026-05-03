package com.flexshell.persistence.api;

import com.flexshell.appointment.AppointmentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/**
 * Persistence port for {@link AppointmentEntity} (Mongo repository or Postgres JPA).
 */
public interface AppointmentAccess {

    Optional<AppointmentEntity> findById(String id);

    AppointmentEntity save(AppointmentEntity entity);

    void deleteById(String id);

    Page<AppointmentEntity> findByDoctorId(String doctorId, Pageable pageable);

    Page<AppointmentEntity> findByCreatedBy(String createdBy, Pageable pageable);

    Page<AppointmentEntity> findAll(Pageable pageable);

    List<AppointmentEntity> findByDoctorIdAndPreferredDate(String doctorId, String preferredDate);
}
