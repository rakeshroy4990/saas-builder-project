package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientPrescriptionJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PatientPrescriptionJpaRepository extends JpaRepository<PatientPrescriptionJpaEntity, String> {

    Optional<PatientPrescriptionJpaEntity> findByFileHashAndDeletedFalse(String fileHash);

    Optional<PatientPrescriptionJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Page<PatientPrescriptionJpaEntity> findByPatientUserIdAndDeletedFalse(String patientUserId, Pageable pageable);

    Page<PatientPrescriptionJpaEntity> findByDoctorIdAndDeletedFalse(String doctorId, Pageable pageable);

    Page<PatientPrescriptionJpaEntity> findByDeletedFalse(Pageable pageable);

    @Modifying
    @Query(value = """
            UPDATE patient_prescriptions
            SET embedding = CASE
                    WHEN :embeddingVector IS NULL THEN NULL
                    ELSE cast(:embeddingVector AS halfvec(3072))
                END,
                extracted_data = cast(:extractedJson AS jsonb),
                search_text = :searchText,
                doctor_name = :doctorName,
                department = :department,
                patient_name = :patientName,
                patient_gender = :patientGender,
                status = :status,
                updated_at = now()
            WHERE id = :id AND deleted = false
            """, nativeQuery = true)
    int updateExtractionNative(
            @Param("id") String id,
            @Param("embeddingVector") String embeddingVector,
            @Param("extractedJson") String extractedJson,
            @Param("searchText") String searchText,
            @Param("doctorName") String doctorName,
            @Param("department") String department,
            @Param("patientName") String patientName,
            @Param("patientGender") String patientGender,
            @Param("status") String status
    );
}
