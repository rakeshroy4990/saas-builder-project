package com.flexshell.persistence.api;

import com.flexshell.doctorschedule.DoctorScheduleEntity;

import java.util.Optional;

/**
 * Persistence port for {@link DoctorScheduleEntity} (Mongo or Postgres).
 */
public interface DoctorScheduleAccess {

    Optional<DoctorScheduleEntity> findByDoctorId(String doctorId);

    DoctorScheduleEntity save(DoctorScheduleEntity entity);
}
