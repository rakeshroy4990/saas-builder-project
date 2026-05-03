package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppointmentJpaRepository extends JpaRepository<AppointmentJpaEntity, String> {

    Page<AppointmentJpaEntity> findByDoctorIdAndDeletedFalse(String doctorId, Pageable pageable);

    Page<AppointmentJpaEntity> findByCreatedByAndDeletedFalse(String createdBy, Pageable pageable);

    List<AppointmentJpaEntity> findByDoctorIdAndPreferredDateAndDeletedFalse(String doctorId, String preferredDate);
}
