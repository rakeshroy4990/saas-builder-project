package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.ConsultationTranscriptJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConsultationTranscriptJpaRepository extends JpaRepository<ConsultationTranscriptJpaEntity, Long> {

    Optional<ConsultationTranscriptJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Optional<ConsultationTranscriptJpaEntity> findFirstByConsultationAudioExternalIdAndDeletedFalseOrderByCreatedAtDesc(
            UUID consultationAudioExternalId
    );

    Optional<ConsultationTranscriptJpaEntity> findFirstByAppointmentExternalIdAndDeletedFalseAndCommittedTrueOrderByCreatedAtDesc(
            UUID appointmentExternalId
    );
}
