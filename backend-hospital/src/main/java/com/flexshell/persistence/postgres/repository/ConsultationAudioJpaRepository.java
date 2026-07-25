package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.ConsultationAudioJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConsultationAudioJpaRepository extends JpaRepository<ConsultationAudioJpaEntity, Long> {

    Optional<ConsultationAudioJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    List<ConsultationAudioJpaEntity> findByAppointmentExternalIdAndDeletedFalseAndCommittedTrueOrderByCreatedAtDesc(
            UUID appointmentExternalId
    );

    Optional<ConsultationAudioJpaEntity> findFirstByAppointmentExternalIdAndDoctorUserIdAndDeletedFalseAndCommittedTrueOrderByCreatedAtDesc(
            UUID appointmentExternalId,
            String doctorUserId
    );
}
