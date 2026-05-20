package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientPrescriptionGroupItemJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PatientPrescriptionGroupItemJpaRepository extends JpaRepository<PatientPrescriptionGroupItemJpaEntity, PatientPrescriptionGroupItemJpaEntity.GroupItemId> {

    List<PatientPrescriptionGroupItemJpaEntity> findByGroupIdOrderByPageNumberAsc(String groupId);

    List<PatientPrescriptionGroupItemJpaEntity> findByPrescriptionIdIn(Collection<String> prescriptionIds);

    Optional<PatientPrescriptionGroupItemJpaEntity> findFirstByPrescriptionId(String prescriptionId);

    boolean existsByPrescriptionId(String prescriptionId);

    boolean existsByGroupIdAndPageNumber(String groupId, int pageNumber);

    int countByGroupId(String groupId);
}
