package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientPrescriptionGroupItemJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PatientPrescriptionGroupItemJpaRepository extends JpaRepository<PatientPrescriptionGroupItemJpaEntity, PatientPrescriptionGroupItemJpaEntity.GroupItemId> {

    List<PatientPrescriptionGroupItemJpaEntity> findByGroupIdOrderByPageNumberAsc(String groupId);
}
