package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.MedicalDepartmentMessageJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MedicalDepartmentMessageJpaRepository extends JpaRepository<MedicalDepartmentMessageJpaEntity, Long> {

    Optional<MedicalDepartmentMessageJpaEntity> findByDepartmentIdAndLocaleIgnoreCaseAndDeletedFalse(
            String departmentId,
            String locale
    );

    List<MedicalDepartmentMessageJpaEntity> findByDepartmentIdAndDeletedFalseOrderByLocaleAsc(String departmentId);
}
