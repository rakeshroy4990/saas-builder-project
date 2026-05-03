package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.MedicalDepartmentJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MedicalDepartmentJpaRepository extends JpaRepository<MedicalDepartmentJpaEntity, String> {

    Optional<MedicalDepartmentJpaEntity> findByIdAndDeletedFalse(String id);

    Optional<MedicalDepartmentJpaEntity> findByCodeIgnoreCaseAndDeletedFalse(String code);

    boolean existsByIdAndDeletedFalse(String id);

    Page<MedicalDepartmentJpaEntity> findAllByDeletedFalse(Pageable pageable);
}
