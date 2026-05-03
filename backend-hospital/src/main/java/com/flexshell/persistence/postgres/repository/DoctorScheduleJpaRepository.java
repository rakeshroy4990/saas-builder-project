package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.DoctorScheduleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DoctorScheduleJpaRepository extends JpaRepository<DoctorScheduleJpaEntity, String> {

    Optional<DoctorScheduleJpaEntity> findByDoctorIdAndDeletedFalse(String doctorId);

    Optional<DoctorScheduleJpaEntity> findByDoctorId(String doctorId);
}
