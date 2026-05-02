package com.flexshell.email;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SentEmailRepository extends MongoRepository<SentEmailEntity, String> {

    List<SentEmailEntity> findByPatientIdOrderByCreatedTimestampDesc(String patientId);

    List<SentEmailEntity> findByDoctorIdOrderByCreatedTimestampDesc(String doctorId);

    Page<SentEmailEntity> findByEvent(String event, Pageable pageable);
}
