package com.flexshell.doctorschedule;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DoctorScheduleRepository extends MongoRepository<DoctorScheduleEntity, String> {
    Optional<DoctorScheduleEntity> findByDoctorId(String doctorId);
}
