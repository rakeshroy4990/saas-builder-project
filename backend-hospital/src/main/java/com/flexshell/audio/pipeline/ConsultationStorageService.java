package com.flexshell.audio.pipeline;

import com.flexshell.persistence.postgres.model.ConsultationAudioJpaEntity;
import com.flexshell.persistence.postgres.model.ConsultationTranscriptJpaEntity;
import com.flexshell.persistence.postgres.repository.ConsultationAudioJpaRepository;
import com.flexshell.persistence.postgres.repository.ConsultationTranscriptJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ConsultationStorageService {

    private final ConsultationAudioJpaRepository audioRepository;
    private final ConsultationTranscriptJpaRepository transcriptRepository;

    public ConsultationStorageService(
            ConsultationAudioJpaRepository audioRepository,
            ConsultationTranscriptJpaRepository transcriptRepository
    ) {
        this.audioRepository = audioRepository;
        this.transcriptRepository = transcriptRepository;
    }

    @Transactional
    public ConsultationAudioJpaEntity saveAudio(ConsultationAudioJpaEntity entity) {
        return audioRepository.save(entity);
    }

    @Transactional
    public ConsultationTranscriptJpaEntity saveTranscript(ConsultationTranscriptJpaEntity entity) {
        return transcriptRepository.save(entity);
    }

    public Optional<ConsultationAudioJpaEntity> findAudio(UUID externalId) {
        return audioRepository.findByExternalIdAndDeletedFalse(externalId);
    }

    public Optional<ConsultationTranscriptJpaEntity> findTranscriptByAudio(UUID audioExternalId) {
        return transcriptRepository.findFirstByConsultationAudioExternalIdAndDeletedFalseOrderByCreatedAtDesc(
                audioExternalId
        );
    }

    public Optional<ConsultationTranscriptJpaEntity> findCommittedByAppointment(UUID appointmentExternalId) {
        return transcriptRepository.findFirstByAppointmentExternalIdAndDeletedFalseAndCommittedTrueOrderByCreatedAtDesc(
                appointmentExternalId
        );
    }

    public Optional<ConsultationAudioJpaEntity> findCommittedAudio(
            UUID appointmentExternalId,
            String doctorUserId
    ) {
        return audioRepository.findFirstByAppointmentExternalIdAndDoctorUserIdAndDeletedFalseAndCommittedTrueOrderByCreatedAtDesc(
                appointmentExternalId,
                doctorUserId
        );
    }

    @Transactional
    public void commit(
            ConsultationAudioJpaEntity audio,
            ConsultationTranscriptJpaEntity transcript,
            String transcriptText,
            List<Map<String, Object>> transcriptJson,
            Map<String, Object> structured,
            Map<String, Object> summary,
            Map<String, Object> soap,
            Map<String, Object> prescription
    ) {
        audio.setCommitted(true);
        audio.setStatus("SAVED");
        audioRepository.save(audio);

        transcript.setTranscriptText(transcriptText);
        transcript.setTranscriptJson(transcriptJson);
        transcript.setStructuredJson(structured);
        transcript.setSummaryJson(summary);
        transcript.setSoapJson(soap);
        transcript.setPrescriptionJson(prescription);
        transcript.setCommitted(true);
        transcriptRepository.save(transcript);
    }
}
