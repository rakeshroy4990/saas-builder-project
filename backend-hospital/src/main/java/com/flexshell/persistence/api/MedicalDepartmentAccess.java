package com.flexshell.persistence.api;

import com.flexshell.medicaldepartment.MedicalDepartmentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

/**
 * Persistence port for {@link MedicalDepartmentEntity} (Mongo or Postgres).
 */
public interface MedicalDepartmentAccess {

    Optional<MedicalDepartmentEntity> findById(String id);

    Optional<MedicalDepartmentEntity> findByCodeIgnoreCase(String code);

    MedicalDepartmentEntity save(MedicalDepartmentEntity entity);

    void deleteById(String id);

    boolean existsById(String id);

    Page<MedicalDepartmentEntity> findAll(Pageable pageable);
}
