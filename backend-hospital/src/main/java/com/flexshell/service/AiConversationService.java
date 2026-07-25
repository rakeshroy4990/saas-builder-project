package com.flexshell.service;

import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.OpenAiSpeechAdapter;
import com.flexshell.audio.pipeline.AudioUploadService;
import com.flexshell.audio.pipeline.ClinicalSummaryService;
import com.flexshell.audio.pipeline.ConsultationProcessorRegistry;
import com.flexshell.audio.pipeline.ConsultationStorageService;
import com.flexshell.audio.pipeline.ConversationAnalyzerService;
import com.flexshell.audio.pipeline.PrescriptionFromConversationService;
import com.flexshell.audio.pipeline.SpeakerDiarizationService;
import com.flexshell.audio.pipeline.SpeechRecognitionService;
import com.flexshell.controller.dto.audio.AudioApplyPrescriptionRequest;
import com.flexshell.controller.dto.audio.AudioConversationResponse;
import com.flexshell.controller.dto.audio.AudioSaveRequest;
import com.flexshell.controller.dto.audio.AudioStartRequest;
import com.flexshell.persistence.postgres.model.ConsultationAudioJpaEntity;
import com.flexshell.persistence.postgres.model.ConsultationTranscriptJpaEntity;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.prescription.StructuredPrescriptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class AiConversationService {

    private static final Logger LOG = LoggerFactory.getLogger(AiConversationService.class);

    private final AppointmentJpaRepository appointmentRepository;
    private final ConsultationStorageService storageService;
    private final AudioUploadService audioUploadService;
    private final SpeechRecognitionService speechRecognitionService;
    private final SpeakerDiarizationService speakerDiarizationService;
    private final ConversationAnalyzerService conversationAnalyzerService;
    private final ClinicalSummaryService clinicalSummaryService;
    private final PrescriptionFromConversationService prescriptionFromConversationService;
    private final StructuredPrescriptionService structuredPrescriptionService;
    private final ConsultationProcessorRegistry processorRegistry;

    public AiConversationService(
            AppointmentJpaRepository appointmentRepository,
            ConsultationStorageService storageService,
            AudioUploadService audioUploadService,
            SpeechRecognitionService speechRecognitionService,
            SpeakerDiarizationService speakerDiarizationService,
            ConversationAnalyzerService conversationAnalyzerService,
            ClinicalSummaryService clinicalSummaryService,
            PrescriptionFromConversationService prescriptionFromConversationService,
            StructuredPrescriptionService structuredPrescriptionService,
            ConsultationProcessorRegistry processorRegistry
    ) {
        this.appointmentRepository = appointmentRepository;
        this.storageService = storageService;
        this.audioUploadService = audioUploadService;
        this.speechRecognitionService = speechRecognitionService;
        this.speakerDiarizationService = speakerDiarizationService;
        this.conversationAnalyzerService = conversationAnalyzerService;
        this.clinicalSummaryService = clinicalSummaryService;
        this.prescriptionFromConversationService = prescriptionFromConversationService;
        this.structuredPrescriptionService = structuredPrescriptionService;
        this.processorRegistry = processorRegistry;
    }

    @Transactional
    public AudioConversationResponse start(String doctorUserId, AudioStartRequest request) {
        requireDoctor(doctorUserId);
        if (request == null || !Boolean.TRUE.equals(request.consentAcknowledged())) {
            throw new IllegalArgumentException("AUDIO_CONSENT_REQUIRED");
        }
        UUID appointmentId = parseUuid(request.appointmentId(), "AUDIO_APPOINTMENT_INVALID");
        AppointmentJpaEntity appointment = appointmentRepository
                .findByExternalIdAndDeletedFalse(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        if (!doctorUserId.equalsIgnoreCase(Objects.toString(appointment.getDoctorId(), "").trim())) {
            throw new SecurityException("AUDIO_FORBIDDEN");
        }
        String patientId = Objects.toString(appointment.getCreatedBy(), "").trim();
        if (patientId.isBlank()) {
            throw new IllegalArgumentException("AUDIO_PATIENT_MISSING");
        }

        ConsultationAudioJpaEntity audio = new ConsultationAudioJpaEntity();
        audio.setAppointmentExternalId(appointmentId);
        audio.setDoctorUserId(doctorUserId);
        audio.setPatientUserId(patientId);
        audio.setConsentAcknowledged(true);
        audio.setLanguageHint(normalizeLanguageHint(request.languageHint()));
        audio.setStatus("STARTED");
        audio.setCommitted(false);
        audio.setDeleted(false);
        audio = storageService.saveAudio(audio);

        ConsultationTranscriptJpaEntity transcript = new ConsultationTranscriptJpaEntity();
        transcript.setConsultationAudioExternalId(audio.getExternalId());
        transcript.setAppointmentExternalId(appointmentId);
        transcript.setCommitted(false);
        transcript.setDeleted(false);
        storageService.saveTranscript(transcript);

        LOG.info(
                "ai_conversation_started sessionId={} appointmentId={} doctorIdHash={}",
                audio.getExternalId(),
                appointmentId,
                Integer.toHexString(doctorUserId.hashCode())
        );

        return toResponse(audio, transcript, null);
    }

    @Transactional
    public AudioConversationResponse upload(
            String doctorUserId,
            String sessionId,
            Integer durationSeconds,
            Integer chunkIndex,
            MultipartFile file
    ) {
        ConsultationAudioJpaEntity audio = requireOwnedDraft(doctorUserId, sessionId);
        ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());

        if (chunkIndex != null) {
            if (chunkIndex < 0) {
                throw new IllegalArgumentException("AUDIO_CHUNK_INVALID");
            }
            // Accept current next index, or retry of last written index.
            int expected = audio.getChunkCount();
            if (chunkIndex != expected && chunkIndex != expected - 1) {
                throw new IllegalArgumentException("AUDIO_CHUNK_OUT_OF_ORDER");
            }
            String dir = audioUploadService.sessionDir(doctorUserId, audio.getExternalId());
            audioUploadService.storeChunk(doctorUserId, audio.getExternalId(), chunkIndex, file);
            audio.setAudioStoragePath(dir);
            if (chunkIndex == expected) {
                audio.setChunkCount(expected + 1);
            }
            if (durationSeconds != null && durationSeconds >= 0) {
                audio.setDurationSeconds(durationSeconds);
            }
            audio.setStatus("RECORDING");
            audio = storageService.saveAudio(audio);
            return toResponse(audio, transcript, audioUploadService.accessUrl(dir));
        }

        String path = audioUploadService.store(doctorUserId, audio.getExternalId(), file);
        audio.setAudioStoragePath(path);
        audio.setChunkCount(0);
        if (durationSeconds != null && durationSeconds >= 0) {
            audio.setDurationSeconds(durationSeconds);
        }
        audio.setStatus("UPLOADED");
        audio = storageService.saveAudio(audio);
        return toResponse(audio, transcript, audioUploadService.accessUrl(path));
    }

    @Transactional
    public AudioConversationResponse transcribe(String doctorUserId, String sessionId, boolean swapSpeakers) {
        ConsultationAudioJpaEntity audio = requireOwnedDraft(doctorUserId, sessionId);
        byte[] bytes;
        String filename;
        if (audio.getChunkCount() > 0) {
            bytes = audioUploadService.readAssembledChunks(
                    doctorUserId,
                    audio.getExternalId(),
                    audio.getChunkCount()
            );
            filename = "consultation.webm";
            audio.setStatus("UPLOADED");
            storageService.saveAudio(audio);
        } else if (audio.getAudioStoragePath() != null && !audio.getAudioStoragePath().isBlank()
                && !audio.getAudioStoragePath().endsWith("/")) {
            bytes = audioUploadService.read(audio.getAudioStoragePath());
            filename = audio.getAudioStoragePath().contains(".")
                    ? audio.getAudioStoragePath().substring(audio.getAudioStoragePath().lastIndexOf('/') + 1)
                    : "consultation.webm";
        } else {
            throw new IllegalArgumentException("AUDIO_NOT_UPLOADED");
        }
        try {
            OpenAiSpeechAdapter.TranscriptionResult stt = speechRecognitionService.transcribe(
                    bytes,
                    filename,
                    guessMime(filename),
                    audio.getLanguageHint()
            );
            List<Map<String, Object>> turns = speakerDiarizationService.diarize(stt.text(), swapSpeakers);
            String plain = SpeakerDiarizationService.toPlainText(turns);

            ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());
            transcript.setTranscriptJson(turns);
            transcript.setTranscriptText(plain);
            transcript.setSpeakersSwapped(swapSpeakers);
            storageService.saveTranscript(transcript);

            audio.setLanguageDetected(stt.language());
            audio.setStatus("TRANSCRIBED");
            audio = storageService.saveAudio(audio);

            return toResponse(audio, transcript, audioUploadService.accessUrl(audio.getAudioStoragePath()));
        } catch (AiProviderException ex) {
            audio.setStatus("FAILED");
            storageService.saveAudio(audio);
            throw ex;
        }
    }

    @Transactional
    public AudioConversationResponse analyze(String doctorUserId, String sessionId) {
        ConsultationAudioJpaEntity audio = requireOwnedDraft(doctorUserId, sessionId);
        ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());
        String plain = Objects.toString(transcript.getTranscriptText(), "").trim();
        if (plain.isBlank()) {
            throw new IllegalArgumentException("AUDIO_TRANSCRIPT_EMPTY");
        }
        Map<String, Object> structured = conversationAnalyzerService.analyze(plain);
        transcript.setStructuredJson(structured);
        storageService.saveTranscript(transcript);
        audio.setStatus("ANALYZED");
        audio = storageService.saveAudio(audio);

        Map<String, Object> ctx = new HashMap<>();
        ctx.put("SessionId", audio.getExternalId().toString());
        ctx.put("AppointmentId", audio.getAppointmentExternalId().toString());
        processorRegistry.afterStructuredAnalysis(structured, ctx);

        return toResponse(audio, transcript, null);
    }

    @Transactional
    public AudioConversationResponse generateSummary(String doctorUserId, String sessionId) {
        ConsultationAudioJpaEntity audio = requireOwnedDraft(doctorUserId, sessionId);
        ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());
        Map<String, Object> structured = transcript.getStructuredJson();
        if (structured == null || structured.isEmpty()) {
            throw new IllegalArgumentException("AUDIO_STRUCTURED_EMPTY");
        }
        Map<String, Object> summary = clinicalSummaryService.generate(structured);
        @SuppressWarnings("unchecked")
        Map<String, Object> soap = summary.get("Soap") instanceof Map<?, ?> m
                ? (Map<String, Object>) m
                : Map.of();
        transcript.setSummaryJson(summary);
        transcript.setSoapJson(soap);
        storageService.saveTranscript(transcript);
        audio.setStatus("SUMMARIZED");
        audio = storageService.saveAudio(audio);

        Map<String, Object> ctx = new HashMap<>();
        ctx.put("SessionId", audio.getExternalId().toString());
        processorRegistry.afterClinicalSummary(summary, ctx);

        return toResponse(audio, transcript, null);
    }

    @Transactional
    public AudioConversationResponse generatePrescription(String doctorUserId, String sessionId) {
        ConsultationAudioJpaEntity audio = requireOwnedDraft(doctorUserId, sessionId);
        ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());
        String plain = Objects.toString(transcript.getTranscriptText(), "").trim();
        Map<String, Object> structured = transcript.getStructuredJson();
        Map<String, Object> summary = transcript.getSummaryJson();
        if (plain.isBlank() && (structured == null || structured.isEmpty())) {
            throw new IllegalArgumentException("AUDIO_TRANSCRIPT_EMPTY");
        }
        Map<String, Object> prescription = prescriptionFromConversationService.generate(plain, structured, summary);
        transcript.setPrescriptionJson(prescription);
        storageService.saveTranscript(transcript);
        audio.setStatus("PRESCRIPTION_READY");
        audio = storageService.saveAudio(audio);
        return toResponse(audio, transcript, null);
    }

    /**
     * Merges generated/edited medicines + advice into the appointment's structured e-prescription draft.
     * Requires a completed appointment (same rule as the e-prescription UI).
     */
    @Transactional
    public AudioConversationResponse applyPrescriptionToEprescription(
            String doctorUserId,
            AudioApplyPrescriptionRequest request
    ) {
        if (request == null || request.sessionId() == null || request.sessionId().isBlank()) {
            throw new IllegalArgumentException("AUDIO_SESSION_INVALID");
        }
        ConsultationAudioJpaEntity audio = requireOwned(doctorUserId, request.sessionId());
        ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());
        Map<String, Object> prescription = request.prescription() != null && !request.prescription().isEmpty()
                ? request.prescription()
                : transcript.getPrescriptionJson();
        if (prescription == null || prescription.isEmpty()) {
            throw new IllegalArgumentException("AUDIO_PRESCRIPTION_EMPTY");
        }
        if (!audio.isCommitted()) {
            transcript.setPrescriptionJson(prescription);
            storageService.saveTranscript(transcript);
        }
        String appointmentId = audio.getAppointmentExternalId().toString();
        structuredPrescriptionService.getOrCreateDraft(appointmentId, doctorUserId);
        Map<String, Object> patch = PrescriptionFromConversationService.toEprescriptionPatch(prescription);
        if (patch.isEmpty()) {
            throw new IllegalArgumentException("AUDIO_PRESCRIPTION_EMPTY");
        }
        structuredPrescriptionService.saveDraft(appointmentId, patch, doctorUserId);
        return toResponse(audio, transcript, null);
    }

    @Transactional
    public AudioConversationResponse save(String doctorUserId, AudioSaveRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("AUDIO_SAVE_INVALID");
        }
        ConsultationAudioJpaEntity audio = requireOwnedDraft(doctorUserId, request.sessionId());
        ConsultationTranscriptJpaEntity transcript = requireTranscript(audio.getExternalId());

        List<Map<String, Object>> turns = request.transcript() != null
                ? request.transcript()
                : transcript.getTranscriptJson();
        String text = request.transcriptText() != null
                ? request.transcriptText()
                : SpeakerDiarizationService.toPlainText(turns);
        Map<String, Object> structured = request.structuredJson() != null
                ? request.structuredJson()
                : transcript.getStructuredJson();
        Map<String, Object> summary = request.summary() != null
                ? request.summary()
                : transcript.getSummaryJson();
        Map<String, Object> soap = request.soap() != null
                ? request.soap()
                : (summary != null && summary.get("Soap") instanceof Map<?, ?> m
                        ? castMap(m)
                        : transcript.getSoapJson());
        Map<String, Object> prescription = request.prescription() != null
                ? request.prescription()
                : transcript.getPrescriptionJson();

        storageService.commit(audio, transcript, text, turns, structured, summary, soap, prescription);
        LOG.info(
                "ai_conversation_saved sessionId={} appointmentId={}",
                audio.getExternalId(),
                audio.getAppointmentExternalId()
        );
        return toResponse(audio, transcript, audio.getAudioStoragePath() == null
                ? null
                : audioUploadService.accessUrl(audio.getAudioStoragePath()));
    }

    @Transactional(readOnly = true)
    public AudioConversationResponse getByAppointment(String doctorUserId, String appointmentIdRaw) {
        requireDoctor(doctorUserId);
        UUID appointmentId = parseUuid(appointmentIdRaw, "AUDIO_APPOINTMENT_INVALID");
        ConsultationAudioJpaEntity audio = storageService
                .findCommittedAudio(appointmentId, doctorUserId)
                .orElseThrow(() -> new IllegalArgumentException("AUDIO_NOT_FOUND"));
        ConsultationTranscriptJpaEntity transcript = storageService
                .findTranscriptByAudio(audio.getExternalId())
                .orElseThrow(() -> new IllegalArgumentException("AUDIO_NOT_FOUND"));
        String url = audio.getAudioStoragePath() == null
                ? null
                : audioUploadService.accessUrl(audio.getAudioStoragePath());
        return toResponse(audio, transcript, url);
    }

    private ConsultationAudioJpaEntity requireOwnedDraft(String doctorUserId, String sessionIdRaw) {
        ConsultationAudioJpaEntity audio = requireOwned(doctorUserId, sessionIdRaw);
        if (audio.isCommitted()) {
            throw new IllegalArgumentException("AUDIO_ALREADY_SAVED");
        }
        return audio;
    }

    private ConsultationAudioJpaEntity requireOwned(String doctorUserId, String sessionIdRaw) {
        requireDoctor(doctorUserId);
        UUID sessionId = parseUuid(sessionIdRaw, "AUDIO_SESSION_INVALID");
        ConsultationAudioJpaEntity audio = storageService
                .findAudio(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("AUDIO_SESSION_NOT_FOUND"));
        if (!doctorUserId.equalsIgnoreCase(audio.getDoctorUserId())) {
            throw new SecurityException("AUDIO_FORBIDDEN");
        }
        return audio;
    }

    private ConsultationTranscriptJpaEntity requireTranscript(UUID audioExternalId) {
        return storageService
                .findTranscriptByAudio(audioExternalId)
                .orElseThrow(() -> new IllegalArgumentException("AUDIO_TRANSCRIPT_MISSING"));
    }

    private static void requireDoctor(String doctorUserId) {
        if (doctorUserId == null || doctorUserId.isBlank()) {
            throw new SecurityException("AUDIO_UNAUTHORIZED");
        }
    }

    private static UUID parseUuid(String raw, String errorCode) {
        try {
            return UUID.fromString(Objects.toString(raw, "").trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private static String normalizeLanguageHint(String hint) {
        String h = Objects.toString(hint, "mixed").trim().toLowerCase(Locale.ROOT);
        return switch (h) {
            case "en", "english" -> "en";
            case "hi", "hindi" -> "hi";
            case "kn", "kannada" -> "kn";
            default -> "mixed";
        };
    }

    private static String guessMime(String filename) {
        String lower = Objects.toString(filename, "").toLowerCase(Locale.ROOT);
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        return "audio/webm";
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }

    private AudioConversationResponse toResponse(
            ConsultationAudioJpaEntity audio,
            ConsultationTranscriptJpaEntity transcript,
            String audioUrl
    ) {
        Map<String, Object> summary = transcript.getSummaryJson();
        Map<String, Object> soap = transcript.getSoapJson();
        if ((soap == null || soap.isEmpty()) && summary != null && summary.get("Soap") instanceof Map<?, ?> m) {
            soap = castMap(m);
        }
        Map<String, Object> prescription = transcript.getPrescriptionJson();
        if (prescription == null || prescription.isEmpty()) {
            prescription = PrescriptionFromConversationService.empty();
        }
        return new AudioConversationResponse(
                audio.getExternalId().toString(),
                audio.getAppointmentExternalId().toString(),
                audio.getStatus(),
                audio.getDurationSeconds(),
                audio.getChunkCount(),
                audio.getLanguageDetected(),
                audio.getLanguageHint(),
                audioUrl,
                transcript.getTranscriptText(),
                transcript.getTranscriptJson(),
                transcript.isSpeakersSwapped(),
                transcript.getStructuredJson(),
                summary,
                soap,
                prescription,
                audio.isCommitted()
        );
    }
}
