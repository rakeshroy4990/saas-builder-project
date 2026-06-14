package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.PatientPrescriptionJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientPrescriptionJpaRepository extends JpaRepository<PatientPrescriptionJpaEntity, String> {

    Optional<PatientPrescriptionJpaEntity> findByFileHashAndDeletedFalse(String fileHash);

    Optional<PatientPrescriptionJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Page<PatientPrescriptionJpaEntity> findByPatientUserIdAndDeletedFalse(String patientUserId, Pageable pageable);

    Page<PatientPrescriptionJpaEntity> findByDoctorIdAndDeletedFalse(String doctorId, Pageable pageable);

    @Query(
            value = """
                    SELECT p.*
                    FROM patient_prescriptions p
                    WHERE p.deleted = false
                      AND (
                          p.doctor_id = :doctorId
                          OR p.patient_user_id = :doctorId
                          OR p.uploaded_by = :doctorId
                          OR EXISTS (
                              SELECT 1
                              FROM appointments a
                              WHERE a.id = p.appointment_id
                                AND a.deleted = false
                                AND a.doctor_id = :doctorId
                          )
                      )
                    ORDER BY p.created_at DESC
                    """,
            countQuery = """
                    SELECT COUNT(*)
                    FROM patient_prescriptions p
                    WHERE p.deleted = false
                      AND (
                          p.doctor_id = :doctorId
                          OR p.patient_user_id = :doctorId
                          OR p.uploaded_by = :doctorId
                          OR EXISTS (
                              SELECT 1
                              FROM appointments a
                              WHERE a.id = p.appointment_id
                                AND a.deleted = false
                                AND a.doctor_id = :doctorId
                          )
                      )
                    """,
            nativeQuery = true
    )
    Page<PatientPrescriptionJpaEntity> findVisibleToDoctor(@Param("doctorId") String doctorId, Pageable pageable);

    Page<PatientPrescriptionJpaEntity> findByDeletedFalse(Pageable pageable);

    @Query(
            value = """
                    SELECT p.*
                    FROM patient_prescriptions p
                    WHERE p.deleted = false
                      AND p.patient_user_id = :patientUserId
                      AND p.status = 'verified'
                      AND p.created_at >= now() - make_interval(days => :lookbackDays)
                      AND p.external_id <> :excludeExternalId
                    ORDER BY p.created_at DESC
                    """,
            nativeQuery = true
    )
    List<PatientPrescriptionJpaEntity> findRecentVerifiedForPatient(
            @Param("patientUserId") String patientUserId,
            @Param("lookbackDays") int lookbackDays,
            @Param("excludeExternalId") UUID excludeExternalId
    );

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
