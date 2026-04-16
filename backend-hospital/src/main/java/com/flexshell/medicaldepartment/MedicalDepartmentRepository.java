package com.flexshell.medicaldepartment;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface MedicalDepartmentRepository extends MongoRepository<MedicalDepartmentEntity, String> {
    Optional<MedicalDepartmentEntity> findByCodeIgnoreCase(String code);
}
