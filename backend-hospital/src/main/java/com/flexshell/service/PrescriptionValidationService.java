package com.flexshell.service;

import com.flexshell.ai.PdfRagPrescriptionValidationAdapter;
import com.flexshell.auth.JwtService;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.DoctorPrescriptionMedicationDto;
import com.flexshell.controller.dto.DoctorPrescriptionSafetyValidateRequest;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.controller.dto.RecommendedDosageRequest;
import com.flexshell.controller.dto.RecommendedDosageResponse;
import com.flexshell.controller.dto.PrescriptionDosageFindingDto;
import com.flexshell.controller.dto.PrescriptionInteractionFindingDto;
import com.flexshell.controller.dto.PrescriptionValidationResponse;
import com.flexshell.http.NdjsonStreamWriter;
import com.flexshell.notification.NotificationTriggerSupport;
import com.flexshell.notification.NotificationService;
import com.flexshell.persistence.postgres.model.ChildProfileJpaEntity;
import com.flexshell.persistence.postgres.model.GrowthRecordJpaEntity;
import com.flexshell.persistence.postgres.model.PatientPrescriptionJpaEntity;
import com.flexshell.persistence.postgres.model.PrescriptionValidationJpaEntity;
import com.flexshell.persistence.postgres.repository.ChildProfileJpaRepository;
import com.flexshell.persistence.postgres.repository.GrowthRecordJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionJpaRepository;
import com.flexshell.persistence.postgres.repository.PrescriptionValidationJpaRepository;
import com.flexshell.prescription.PrescriptionMedicationParser;
import com.flexshell.prescription.PrescriptionSummarySupport;
import com.flexshell.prescription.PrescriptionVitalsExtractor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class PrescriptionValidationService {

    private static final Logger LOG = LoggerFactory.getLogger(PrescriptionValidationService.class);
    private static final int ACTIVE_DRUG_LOOKBACK_DAYS = 14;

    private final PatientPrescriptionJpaRepository patientPrescriptionRepository;
    private final PrescriptionValidationJpaRepository validationRepository;
    private final ChildProfileJpaRepository childProfileRepository;
    private final GrowthRecordJpaRepository growthRecordRepository;
    private final ChildProfileService childProfileService;
    private final PdfRagPrescriptionValidationAdapter validationAdapter;
    private final EducationPrescriptionTranscriptionService transcriptionService;
    private final JwtService jwtService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final boolean asyncEnabled;

    public PrescriptionValidationService(
            PatientPrescriptionJpaRepository patientPrescriptionRepository,
            PrescriptionValidationJpaRepository validationRepository,
            ChildProfileJpaRepository childProfileRepository,
            GrowthRecordJpaRepository growthRecordRepository,
            ChildProfileService childProfileService,
            PdfRagPrescriptionValidationAdapter validationAdapter,
            EducationPrescriptionTranscriptionService transcriptionService,
            JwtService jwtService,
            NotificationService notificationService,
            ObjectMapper objectMapper,
            @Value("${app.prescription.validation.async:true}") boolean asyncEnabled
    ) {
        this.patientPrescriptionRepository = patientPrescriptionRepository;
        this.validationRepository = validationRepository;
        this.childProfileRepository = childProfileRepository;
        this.growthRecordRepository = growthRecordRepository;
        this.childProfileService = childProfileService;
        this.validationAdapter = validationAdapter;
        this.transcriptionService = transcriptionService;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
        this.asyncEnabled = asyncEnabled;
    }

    @Async("patientPrescriptionExecutor")
    public void validatePatientPrescriptionAsync(UUID patientPrescriptionExternalId) {
        if (!asyncEnabled) {
            return;
        }
        try {
            validatePatientPrescription(patientPrescriptionExternalId, null);
        } catch (Exception ex) {
            LOG.warn("prescription_validation_async_failed externalId={}", patientPrescriptionExternalId);
        }
    }

    @Transactional
    public PrescriptionValidationResponse validatePatientPrescription(
            UUID patientPrescriptionExternalId,
            String authorizationHeader
    ) {
        PatientPrescriptionJpaEntity rx = patientPrescriptionRepository
                .findByExternalIdAndDeletedFalse(patientPrescriptionExternalId)
                .orElseThrow(() -> new IllegalArgumentException("PATIENT_PRESCRIPTION_NOT_FOUND"));

        List<Map<String, Object>> medications = PrescriptionMedicationParser.fromExtractedData(rx.getExtractedData());
        ChildContext child = resolveChildContext(rx.getPatientUserId());
        List<String> activeDrugNames = collectActiveDrugNames(rx);

        Map<String, Object> ragResult = validationAdapter.validate(
                medications,
                activeDrugNames,
                child.ageMonths(),
                child.weightKg(),
                child.weightSource(),
                resolveAuthorization(authorizationHeader, rx.getPatientUserId())
        );

        PrescriptionValidationJpaEntity row = mapToEntity(
                ragResult,
                "patient_upload",
                patientPrescriptionExternalId,
                null,
                child
        );
        validationRepository.save(row);
        maybeNotify(rx, row);
        return toResponse(row);
    }

    @Transactional
    public PrescriptionValidationResponse markReviewed(
            UUID patientPrescriptionExternalId,
            String doctorUserId
    ) {
        PrescriptionValidationJpaEntity row = validationRepository
                .findFirstByPatientPrescriptionExternalIdOrderByCreatedAtDesc(patientPrescriptionExternalId)
                .orElseThrow(() -> new IllegalArgumentException("PRESCRIPTION_VALIDATION_NOT_FOUND"));
        row.setReviewedByDoctor(true);
        row.setReviewedAt(Instant.now());
        row.setReviewedByUserId(doctorUserId);
        validationRepository.save(row);
        return toResponse(row);
    }

    @Transactional(readOnly = true)
    public Optional<PrescriptionValidationResponse> getLatestForPatientPrescription(UUID externalId) {
        return validationRepository.findFirstByPatientPrescriptionExternalIdOrderByCreatedAtDesc(externalId)
                .map(this::toResponse);
    }

    public PrescriptionValidationResponse validateForDoctor(
            String actorUserId,
            DoctorPrescriptionSafetyValidateRequest request,
            String authorizationHeader
    ) {
        return runDoctorValidation(actorUserId, request, authorizationHeader, true);
    }

    /**
     * Doctor dashboard upload flow — only the prescription file (transcribed medicines) is required.
     * Child age/weight are optional; dosage range checks are skipped when weight is unavailable.
     */
    public PrescriptionValidationResponse validatePrescriptionUploadForDoctor(
            String actorUserId,
            DoctorPrescriptionSafetyValidateRequest request,
            String authorizationHeader
    ) {
        return runDoctorValidation(actorUserId, request, authorizationHeader, true);
    }

    public PrescriptionValidationResponse validatePrescriptionUploadFromFile(
            String actorUserId,
            MultipartFile file,
            String childProfileExternalId,
            String childAgeMonths,
            String childWeightKg,
            String authorizationHeader
    ) {
        try {
            DoctorPrescriptionSafetyValidateRequest request = prepareDoctorUploadRequest(
                    actorUserId,
                    file,
                    childProfileExternalId,
                    childAgeMonths,
                    childWeightKg,
                    null,
                    null
            );
            return validatePrescriptionUploadForDoctor(actorUserId, request, authorizationHeader);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /**
     * NDJSON stream: transcribe only — ends with {@code complete} carrying editable {@code Summary}.
     */
    public StreamingResponseBody streamTranscribePrescriptionUploadFromFile(
            String actorUserId,
            MultipartFile file,
            String childProfileExternalId,
            String childAgeMonths,
            String childWeightKg
    ) {
        return outputStream -> {
            AtomicBoolean terminalEventSent = new AtomicBoolean(false);
            AtomicReference<String> phase = new AtomicReference<>("starting");
            AtomicBoolean heartbeatRunning = new AtomicBoolean(true);
            Thread heartbeat = new Thread(() -> {
                while (heartbeatRunning.get()) {
                    try {
                        Thread.sleep(10_000L);
                        if (!heartbeatRunning.get() || terminalEventSent.get()) {
                            break;
                        }
                        NdjsonStreamWriter.writePing(outputStream, objectMapper, phase.get());
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (IOException ex) {
                        LOG.debug("doctor_prescription_transcribe_stream_ping_stopped");
                        break;
                    }
                }
            }, "rx-transcribe-heartbeat");
            heartbeat.setDaemon(true);
            heartbeat.start();
            try {
                NdjsonStreamWriter.writeReady(outputStream, objectMapper);
                phase.set("transcribing");
                DoctorUploadPrepareResult prepared = prepareDoctorUploadResult(
                        actorUserId,
                        file,
                        childProfileExternalId,
                        childAgeMonths,
                        childWeightKg,
                        outputStream,
                        phase
                );
                EducationPrescriptionTranscribeData summarySource = prepared.transcribed().withVitals(
                        prepared.request().getChildWeightKg(),
                        prepared.request().getTemperatureF()
                );
                String summary = PrescriptionSummarySupport.formatDoctorSummary(summarySource);
                NdjsonStreamWriter.writeLine(outputStream, objectMapper, "complete", toTranscribeCompletePayload(
                        prepared.transcribed(),
                        prepared.request(),
                        summary
                ));
                terminalEventSent.set(true);
            } catch (IllegalArgumentException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), ex.getMessage());
            } catch (SecurityException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), "EDUCATION_PRESCRIPTION_FORBIDDEN");
            } catch (UncheckedIOException ex) {
                Throwable cause = ex.getCause();
                if (cause instanceof IOException && isClientDisconnect((IOException) cause)) {
                    return;
                }
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        "Prescription transcription failed.",
                        "PRESCRIPTION_SAFETY_TRANSCRIBE_FAILED"
                );
            } catch (Exception ex) {
                LOG.warn("doctor_prescription_transcribe_stream_failed actorId={}", actorUserId);
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        "Prescription transcription failed.",
                        "PRESCRIPTION_SAFETY_TRANSCRIBE_FAILED"
                );
            } finally {
                heartbeatRunning.set(false);
                heartbeat.interrupt();
                if (!terminalEventSent.get()) {
                    try {
                        NdjsonStreamWriter.writeError(
                                outputStream,
                                objectMapper,
                                "Prescription transcription stream ended unexpectedly.",
                                "PRESCRIPTION_SAFETY_TRANSCRIBE_INCOMPLETE"
                        );
                    } catch (IOException ex) {
                        LOG.debug("doctor_prescription_transcribe_stream_fallback_error_failed");
                    }
                }
            }
        };
    }

    /**
     * NDJSON stream: {@code ready} → {@code status} phases → {@code transcribed} → {@code validating} →
     * optional {@code delta} (summary) → {@code complete}.
     */
    public StreamingResponseBody streamValidatePrescriptionUploadFromFile(
            String actorUserId,
            MultipartFile file,
            String childProfileExternalId,
            String childAgeMonths,
            String childWeightKg,
            String authorizationHeader
    ) {
        return outputStream -> {
            AtomicBoolean terminalEventSent = new AtomicBoolean(false);
            AtomicReference<String> phase = new AtomicReference<>("starting");
            AtomicBoolean heartbeatRunning = new AtomicBoolean(true);
            Thread heartbeat = new Thread(() -> {
                while (heartbeatRunning.get()) {
                    try {
                        Thread.sleep(10_000L);
                        if (!heartbeatRunning.get() || terminalEventSent.get()) {
                            break;
                        }
                        NdjsonStreamWriter.writePing(outputStream, objectMapper, phase.get());
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (IOException ex) {
                        LOG.debug("doctor_prescription_validate_stream_ping_stopped");
                        break;
                    }
                }
            }, "rx-validate-heartbeat");
            heartbeat.setDaemon(true);
            heartbeat.start();
            try {
                NdjsonStreamWriter.writeReady(outputStream, objectMapper);
                phase.set("transcribing");
                DoctorPrescriptionSafetyValidateRequest request = prepareDoctorUploadRequest(
                        actorUserId,
                        file,
                        childProfileExternalId,
                        childAgeMonths,
                        childWeightKg,
                        outputStream,
                        phase
                );
                phase.set("validating");
                NdjsonStreamWriter.writeStatus(outputStream, objectMapper, "validating");
                PrescriptionValidationResponse response = validatePrescriptionUploadForDoctor(
                        actorUserId,
                        request,
                        authorizationHeader
                );
                String summary = Objects.toString(response.getLlmSummary(), "").trim();
                if (!summary.isBlank()) {
                    NdjsonStreamWriter.writeTextDelta(outputStream, summary);
                }
                NdjsonStreamWriter.writeLine(outputStream, objectMapper, "complete", toCompletePayload(response));
                terminalEventSent.set(true);
                LOG.info("doctor_prescription_validate_stream_complete_written actorId={}", actorUserId);
            } catch (IllegalArgumentException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), ex.getMessage());
            } catch (SecurityException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), "EDUCATION_PRESCRIPTION_FORBIDDEN");
            } catch (UncheckedIOException ex) {
                Throwable cause = ex.getCause();
                if (cause instanceof IOException && isClientDisconnect((IOException) cause)) {
                    LOG.debug("doctor_prescription_validate_stream_client_closed actorId={}", actorUserId);
                    return;
                }
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        "Prescription validation failed.",
                        "PRESCRIPTION_SAFETY_VALIDATE_FAILED"
                );
            } catch (Exception ex) {
                LOG.warn(
                        "doctor_prescription_validate_stream_failed actorId={} type={}",
                        actorUserId,
                        ex.getClass().getSimpleName()
                );
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        "Prescription validation failed.",
                        "PRESCRIPTION_SAFETY_VALIDATE_FAILED"
                );
            } finally {
                heartbeatRunning.set(false);
                heartbeat.interrupt();
                if (!terminalEventSent.get()) {
                    try {
                        NdjsonStreamWriter.writeError(
                                outputStream,
                                objectMapper,
                                "Prescription validation stream ended unexpectedly.",
                                "PRESCRIPTION_SAFETY_VALIDATE_INCOMPLETE"
                        );
                    } catch (IOException ex) {
                        LOG.debug(
                                "doctor_prescription_validate_stream_fallback_error_failed actorId={} msg={}",
                                actorUserId,
                                ex.getMessage()
                        );
                    }
                }
            }
        };
    }

    private record DoctorUploadPrepareResult(
            DoctorPrescriptionSafetyValidateRequest request,
            EducationPrescriptionTranscribeData transcribed
    ) {
    }

    private DoctorPrescriptionSafetyValidateRequest prepareDoctorUploadRequest(
            String actorUserId,
            MultipartFile file,
            String childProfileExternalId,
            String childAgeMonths,
            String childWeightKg,
            OutputStream streamOut,
            AtomicReference<String> phase
    ) throws IOException {
        return prepareDoctorUploadResult(
                actorUserId,
                file,
                childProfileExternalId,
                childAgeMonths,
                childWeightKg,
                streamOut,
                phase
        ).request();
    }

    private DoctorUploadPrepareResult prepareDoctorUploadResult(
            String actorUserId,
            MultipartFile file,
            String childProfileExternalId,
            String childAgeMonths,
            String childWeightKg,
            OutputStream streamOut,
            AtomicReference<String> phase
    ) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_FILE_REQUIRED");
        }
        if (streamOut != null) {
            if (phase != null) {
                phase.set("transcribing");
            }
            NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "transcribing");
        }
        EducationPrescriptionTranscribeData transcribed =
                PrescriptionVitalsExtractor.enrich(transcriptionService.transcribe(actorUserId, file));
        if (streamOut != null) {
            if (phase != null) {
                phase.set("parsing");
            }
            NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "parsing");
        }
        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromTranscribe(transcribed);
        if (vitals.weightKg() == null || vitals.temperatureF() == null) {
            if (streamOut != null) {
                if (phase != null) {
                    phase.set("extracting_vitals");
                }
                NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "extracting_vitals");
            }
            PrescriptionVitalsExtractor.PrescriptionVitals supplement =
                    transcriptionService.supplementVitalsFromImage(actorUserId, file);
            vitals = PrescriptionVitalsExtractor.merge(vitals, supplement);
        }
        DoctorPrescriptionSafetyValidateRequest request = new DoctorPrescriptionSafetyValidateRequest();
        if (childProfileExternalId != null && !childProfileExternalId.isBlank()) {
            request.setChildProfileExternalId(UUID.fromString(childProfileExternalId.trim()));
        }
        if (childAgeMonths != null && !childAgeMonths.isBlank()) {
            request.setChildAgeMonths(Double.parseDouble(childAgeMonths.trim()));
        } else if (vitals.ageMonths() != null) {
            request.setChildAgeMonths(vitals.ageMonths());
        }
        if (childWeightKg != null && !childWeightKg.isBlank()) {
            request.setChildWeightKg(Double.parseDouble(childWeightKg.trim()));
            request.setWeightSource("manual");
        } else if (vitals.weightKg() != null) {
            request.setChildWeightKg(vitals.weightKg());
            request.setWeightSource("prescription");
        }
        if (vitals.temperatureF() != null) {
            request.setTemperatureF(vitals.temperatureF());
        }
        request.setMedications(toMedicationDtos(transcribed.toExtractedDataMap()));
        if (streamOut != null) {
            writeTranscribedEvent(streamOut, transcribed, request);
        }
        return new DoctorUploadPrepareResult(request, transcribed);
    }

    private void writeTranscribedEvent(
            OutputStream streamOut,
            EducationPrescriptionTranscribeData transcribed,
            DoctorPrescriptionSafetyValidateRequest request
    ) throws IOException {
        List<String> medicines = new ArrayList<>();
        for (DoctorPrescriptionMedicationDto med : request.getMedications()) {
            if (med != null && med.getName() != null && !med.getName().isBlank()) {
                medicines.add(med.getName().trim());
            }
        }
        if (medicines.isEmpty()) {
            medicines.addAll(transcribed.medicines());
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("Medicines", medicines);
        if (request.getChildWeightKg() != null) {
            payload.put("ChildWeightKg", request.getChildWeightKg());
        }
        if (request.getChildAgeMonths() != null) {
            payload.put("ChildAgeMonths", request.getChildAgeMonths());
        }
        if (request.getTemperatureF() != null) {
            payload.put("TemperatureF", request.getTemperatureF());
        }
        payload.put("WeightSource", Objects.toString(request.getWeightSource(), "not_available"));
        EducationPrescriptionTranscribeData summarySource = transcribed.withVitals(
                request.getChildWeightKg(),
                request.getTemperatureF()
        );
        String summary = PrescriptionSummarySupport.formatDoctorSummary(summarySource);
        if (!summary.isBlank()) {
            payload.put("Summary", summary);
        }
        NdjsonStreamWriter.writeLine(streamOut, objectMapper, "transcribed", payload);
    }

    private Map<String, Object> toTranscribeCompletePayload(
            EducationPrescriptionTranscribeData transcribed,
            DoctorPrescriptionSafetyValidateRequest request,
            String summary
    ) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("Summary", summary);
        List<String> medicines = transcribed.medicines();
        data.put("Medicines", medicines == null ? List.of() : medicines);
        if (request.getChildWeightKg() != null) {
            data.put("ChildWeightKg", request.getChildWeightKg());
        }
        if (request.getChildAgeMonths() != null) {
            data.put("ChildAgeMonths", request.getChildAgeMonths());
        }
        if (request.getTemperatureF() != null) {
            data.put("TemperatureF", request.getTemperatureF());
        }
        data.put("WeightSource", Objects.toString(request.getWeightSource(), "not_available"));
        return data;
    }

    private Map<String, Object> toCompletePayload(PrescriptionValidationResponse response) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (response.getExternalId() != null) {
            data.put("ExternalId", response.getExternalId().toString());
        }
        data.put("PrescriptionSource", Objects.toString(response.getPrescriptionSource(), ""));
        data.put("OverallRiskLevel", Objects.toString(response.getOverallRiskLevel(), "none"));
        data.put("WeightSource", Objects.toString(response.getWeightSource(), "not_available"));
        data.put("LlmSummary", Objects.toString(response.getLlmSummary(), ""));
        data.put("UnrecognizedDrugs", response.getUnrecognizedDrugs() == null ? List.of() : response.getUnrecognizedDrugs());
        data.put("InteractionFindings", toFindingMaps(response.getInteractionFindings()));
        data.put("DosageFindings", toFindingMaps(response.getDosageFindings()));
        data.put("ReviewedByDoctor", response.isReviewedByDoctor());
        if (response.getChildWeightKgUsed() != null) {
            data.put("ChildWeightKgUsed", response.getChildWeightKgUsed());
        }
        if (response.getChildAgeMonthsUsed() != null) {
            data.put("ChildAgeMonthsUsed", response.getChildAgeMonthsUsed());
        }
        if (response.getTemperatureFUsed() != null) {
            data.put("TemperatureFUsed", response.getTemperatureFUsed());
        }
        if (response.getCreatedAt() != null) {
            data.put("CreatedAt", response.getCreatedAt().toString());
        }
        return data;
    }

    private List<Map<String, Object>> toFindingMaps(List<?> findings) {
        if (findings == null || findings.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : findings) {
            if (item == null) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.convertValue(item, Map.class);
            out.add(map);
        }
        return out;
    }

    private void writeStreamError(
            OutputStream outputStream,
            AtomicBoolean terminalEventSent,
            String message,
            String errorCode
    ) {
        try {
            NdjsonStreamWriter.writeError(outputStream, objectMapper, message, errorCode);
            terminalEventSent.set(true);
        } catch (IOException io) {
            throw new UncheckedIOException(io);
        }
    }

    private static boolean isClientDisconnect(IOException ex) {
        String msg = Objects.toString(ex.getMessage(), "").toLowerCase();
        return msg.contains("broken pipe") || msg.contains("connection reset") || msg.contains("abort");
    }

    private static List<DoctorPrescriptionMedicationDto> resolveDoctorMedications(
            DoctorPrescriptionSafetyValidateRequest request
    ) {
        String summary = Objects.toString(request.getPrescriptionSummary(), "").trim();
        if (!summary.isBlank()) {
            Map<String, Object> extracted = PrescriptionSummarySupport.toExtractedDataMap(summary);
            List<DoctorPrescriptionMedicationDto> parsed = toMedicationDtos(extracted);
            if (!parsed.isEmpty()) {
                return parsed;
            }
        }
        if (request.getMedications() != null && !request.getMedications().isEmpty()) {
            return request.getMedications();
        }
        return List.of();
    }

    private static void applyVitalsFromSummary(DoctorPrescriptionSafetyValidateRequest request) {
        String summary = Objects.toString(request.getPrescriptionSummary(), "").trim();
        if (summary.isBlank()) {
            return;
        }
        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromAnyText(summary);
        if (vitals.weightKg() != null) {
            request.setChildWeightKg(vitals.weightKg());
            if (request.getWeightSource() == null || request.getWeightSource().isBlank()) {
                request.setWeightSource("prescription");
            }
        }
        if (vitals.temperatureF() != null) {
            request.setTemperatureF(vitals.temperatureF());
        }
        if (vitals.ageMonths() != null && request.getChildAgeMonths() == null) {
            request.setChildAgeMonths(vitals.ageMonths());
        }
    }

    private static List<DoctorPrescriptionMedicationDto> toMedicationDtos(Map<String, Object> extracted) {
        List<Map<String, Object>> parsed = PrescriptionMedicationParser.fromExtractedData(extracted);
        List<DoctorPrescriptionMedicationDto> out = new ArrayList<>();
        for (Map<String, Object> row : parsed) {
            DoctorPrescriptionMedicationDto dto = new DoctorPrescriptionMedicationDto();
            dto.setName(Objects.toString(row.get("name"), "").trim());
            Object dose = row.get("dose_mg");
            if (dose instanceof Number num) {
                dto.setDoseMg(num.doubleValue());
            }
            Object freq = row.get("frequency_per_day");
            if (freq instanceof Number num) {
                dto.setFrequencyPerDay(num.intValue());
            }
            dto.setRoute(Objects.toString(row.get("route"), "oral"));
            if (!dto.getName().isBlank()) {
                out.add(dto);
            }
        }
        return out;
    }

    private PrescriptionValidationResponse runDoctorValidation(
            String actorUserId,
            DoctorPrescriptionSafetyValidateRequest request,
            String authorizationHeader,
            boolean childContextOptional
    ) {
        if (request == null) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_MEDICATIONS_REQUIRED");
        }
        applyVitalsFromSummary(request);
        List<DoctorPrescriptionMedicationDto> medications = resolveDoctorMedications(request);
        if (medications.isEmpty()) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_MEDICATIONS_REQUIRED");
        }
        request.setMedications(medications);
        ChildContext child = childContextOptional
                ? resolveChildContextForDoctorOptional(actorUserId, request)
                : resolveChildContextForDoctor(actorUserId, request);
        List<Map<String, Object>> medicationMaps = toMedicationMaps(request.getMedications());
        Map<String, Object> ragResult = validationAdapter.validate(
                medicationMaps,
                List.of(),
                child.ageMonths(),
                child.weightKg(),
                child.weightSource(),
                resolveAuthorization(authorizationHeader, actorUserId)
        );
        return toEphemeralResponse(ragResult, child, "doctor_tool");
    }

    public RecommendedDosageResponse recommendDosageForDoctor(
            String actorUserId,
            RecommendedDosageRequest request,
            String authorizationHeader
    ) {
        if (request == null || request.getDrugName() == null || request.getDrugName().isBlank()) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_DRUG_NAME_REQUIRED");
        }
        ChildContext child = resolveChildContextForDoctor(actorUserId, toValidateRequest(request));
        if (child.ageMonths() == null) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_CHILD_AGE_REQUIRED");
        }
        if (child.weightKg() == null) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_CHILD_WEIGHT_REQUIRED");
        }
        Map<String, Object> ragResult = validationAdapter.recommendDosage(
                request.getDrugName().trim(),
                child.ageMonths(),
                child.weightKg(),
                request.getRoute(),
                resolveAuthorization(authorizationHeader, actorUserId)
        );
        return toRecommendedResponse(ragResult);
    }

    private DoctorPrescriptionSafetyValidateRequest toValidateRequest(RecommendedDosageRequest request) {
        DoctorPrescriptionSafetyValidateRequest mapped = new DoctorPrescriptionSafetyValidateRequest();
        mapped.setChildProfileExternalId(request.getChildProfileExternalId());
        mapped.setChildAgeMonths(request.getChildAgeMonths());
        mapped.setChildWeightKg(request.getChildWeightKg());
        return mapped;
    }

    private ChildContext resolveChildContextForDoctorOptional(
            String actorUserId,
            DoctorPrescriptionSafetyValidateRequest request
    ) {
        if (request == null) {
            return new ChildContext(null, null, null, null, "not_available");
        }
        if (request.getChildProfileExternalId() != null) {
            return resolveChildProfileContext(actorUserId, request);
        }
        if (request.getChildAgeMonths() != null) {
            String weightSource = request.getChildWeightKg() != null
                    ? firstNonBlank(request.getWeightSource(), "prescription", "manual")
                    : "not_available";
            return new ChildContext(
                    null,
                    request.getChildWeightKg(),
                    request.getChildAgeMonths(),
                    request.getTemperatureF(),
                    weightSource
            );
        }
        if (request.getChildWeightKg() != null || request.getTemperatureF() != null) {
            String weightSource = request.getChildWeightKg() != null
                    ? firstNonBlank(request.getWeightSource(), "prescription")
                    : "not_available";
            return new ChildContext(null, request.getChildWeightKg(), null, request.getTemperatureF(), weightSource);
        }
        return new ChildContext(null, null, null, null, "not_available");
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private ChildContext resolveChildContextForDoctor(
            String actorUserId,
            DoctorPrescriptionSafetyValidateRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("PRESCRIPTION_SAFETY_CHILD_CONTEXT_REQUIRED");
        }
        if (request.getChildProfileExternalId() != null) {
            return resolveChildProfileContext(actorUserId, request);
        }
        if (request.getChildAgeMonths() != null) {
            String weightSource = request.getChildWeightKg() != null
                    ? firstNonBlank(request.getWeightSource(), "prescription", "manual")
                    : "not_available";
            return new ChildContext(
                    null,
                    request.getChildWeightKg(),
                    request.getChildAgeMonths(),
                    request.getTemperatureF(),
                    weightSource
            );
        }
        throw new IllegalArgumentException("PRESCRIPTION_SAFETY_CHILD_CONTEXT_REQUIRED");
    }

    private ChildContext resolveChildProfileContext(
            String actorUserId,
            DoctorPrescriptionSafetyValidateRequest request
    ) {
        ChildProfileJpaEntity child = childProfileService.requireReadableChild(
                actorUserId,
                request.getChildProfileExternalId()
        );
        Double weightKg = request.getChildWeightKg();
        String weightSource = "not_available";
        if (weightKg == null) {
            Optional<GrowthRecordJpaEntity> latestWeight = growthRecordRepository
                    .findFirstByChildProfileExternalIdAndDeletedFalseAndWeightKgIsNotNullOrderByRecordedAtDesc(
                            child.getExternalId()
                    );
            if (latestWeight.isPresent()) {
                weightKg = latestWeight.get().getWeightKg().doubleValue();
                weightSource = "growth_records";
            }
        } else {
            weightSource = firstNonBlank(request.getWeightSource(), "manual");
        }
        Double ageMonths = request.getChildAgeMonths();
        if (ageMonths == null) {
            ageMonths = ChildProfileService.computeAgeMonths(child.getDateOfBirth(), Instant.now()).doubleValue();
        }
        return new ChildContext(
                child.getExternalId(),
                weightKg,
                ageMonths,
                request.getTemperatureF(),
                weightSource
        );
    }

    private List<Map<String, Object>> toMedicationMaps(List<DoctorPrescriptionMedicationDto> medications) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (DoctorPrescriptionMedicationDto med : medications) {
            if (med == null || med.getName() == null || med.getName().isBlank()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", med.getName().trim());
            if (med.getDoseMg() != null) {
                row.put("dose_mg", med.getDoseMg());
            }
            if (med.getFrequencyPerDay() != null) {
                row.put("frequency_per_day", med.getFrequencyPerDay());
            }
            row.put("route", med.getRoute() == null || med.getRoute().isBlank() ? "oral" : med.getRoute());
            out.add(row);
        }
        return out;
    }

    private PrescriptionValidationResponse toEphemeralResponse(
            Map<String, Object> ragResult,
            ChildContext child,
            String source
    ) {
        PrescriptionValidationResponse response = new PrescriptionValidationResponse();
        response.setPrescriptionSource(source);
        if (child.childProfileExternalId() != null) {
            response.setChildProfileExternalId(child.childProfileExternalId());
        }
        if (child.weightKg() != null) {
            response.setChildWeightKgUsed(BigDecimal.valueOf(child.weightKg()));
        }
        if (child.ageMonths() != null) {
            response.setChildAgeMonthsUsed(BigDecimal.valueOf(child.ageMonths()));
        }
        if (child.temperatureF() != null) {
            response.setTemperatureFUsed(BigDecimal.valueOf(child.temperatureF()));
        }
        response.setWeightSource(child.weightSource());
        response.setOverallRiskLevel(stringVal(ragResult, "OverallRiskLevel", "none"));
        response.setLlmSummary(stringVal(ragResult, "LlmSummary", ""));
        response.setUnrecognizedDrugs(stringList(ragResult.get("UnrecognizedDrugs")));
        response.setInteractionFindings(mapInteractions(objectList(ragResult.get("InteractionFindings"))));
        response.setDosageFindings(mapDosages(objectList(ragResult.get("DosageFindings"))));
        response.setCreatedAt(Instant.now());
        return response;
    }

    private RecommendedDosageResponse toRecommendedResponse(Map<String, Object> ragResult) {
        RecommendedDosageResponse response = new RecommendedDosageResponse();
        response.setExtractedName(stringVal(ragResult, "ExtractedName", ""));
        response.setGenericName(stringVal(ragResult, "GenericName", ""));
        response.setStatus(stringVal(ragResult, "Status", ""));
        response.setChildWeightKg(toBigDecimal(ragResult.get("ChildWeightKg")));
        response.setChildAgeMonths(toBigDecimal(ragResult.get("ChildAgeMonths")));
        response.setRoute(stringVal(ragResult, "Route", "oral"));
        response.setDosePerKgMg(toBigDecimal(ragResult.get("DosePerKgMg")));
        response.setMaxSingleDoseMg(toBigDecimal(ragResult.get("MaxSingleDoseMg")));
        response.setMaxDailyDoseMg(toBigDecimal(ragResult.get("MaxDailyDoseMg")));
        Object freqMin = ragResult.get("FrequencyPerDayMin");
        if (freqMin instanceof Number num) {
            response.setFrequencyPerDayMin(num.intValue());
        }
        Object freqMax = ragResult.get("FrequencyPerDayMax");
        if (freqMax instanceof Number num) {
            response.setFrequencyPerDayMax(num.intValue());
        }
        response.setSource(stringVal(ragResult, "Source", ""));
        response.setMessage(stringVal(ragResult, "Message", ""));
        Object range = ragResult.get("ExpectedDoseRangeMg");
        if (range instanceof List<?> list) {
            List<BigDecimal> values = new ArrayList<>();
            for (Object val : list) {
                BigDecimal bd = toBigDecimal(val);
                if (bd != null) {
                    values.add(bd);
                }
            }
            response.setExpectedDoseRangeMg(values);
        }
        return response;
    }

    private List<String> collectActiveDrugNames(PatientPrescriptionJpaEntity current) {
        List<PatientPrescriptionJpaEntity> recent = patientPrescriptionRepository.findRecentVerifiedForPatient(
                current.getPatientUserId(),
                ACTIVE_DRUG_LOOKBACK_DAYS,
                current.getExternalId()
        );
        List<String> names = new ArrayList<>();
        for (PatientPrescriptionJpaEntity row : recent) {
            for (Map<String, Object> med : PrescriptionMedicationParser.fromExtractedData(row.getExtractedData())) {
                Object name = med.get("name");
                if (name != null && !name.toString().isBlank()) {
                    names.add(name.toString().trim());
                }
            }
        }
        return names;
    }

    private ChildContext resolveChildContext(String patientUserId) {
        List<ChildProfileJpaEntity> children = childProfileRepository
                .findByPatientUserIdAndDeletedFalse(patientUserId, PageRequest.of(0, 10))
                .getContent();
        if (children.isEmpty()) {
            return new ChildContext(null, null, null, null, "not_available");
        }

        ChildProfileJpaEntity child = children.size() == 1
                ? children.get(0)
                : children.stream()
                        .max((a, b) -> a.getUpdatedAt().compareTo(b.getUpdatedAt()))
                        .orElse(children.get(0));

        Optional<GrowthRecordJpaEntity> latestWeight = growthRecordRepository
                .findFirstByChildProfileExternalIdAndDeletedFalseAndWeightKgIsNotNullOrderByRecordedAtDesc(
                        child.getExternalId()
                );

        Double weightKg = latestWeight.map(r -> r.getWeightKg().doubleValue()).orElse(null);
        String weightSource = weightKg != null ? "growth_records" : "not_available";
        Double ageMonths = ChildProfileService.computeAgeMonths(child.getDateOfBirth(), Instant.now()).doubleValue();

        return new ChildContext(child.getExternalId(), weightKg, ageMonths, null, weightSource);
    }

    private String resolveAuthorization(String authorizationHeader, String subjectUserId) {
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            return authorizationHeader.trim().startsWith("Bearer ")
                    ? authorizationHeader.trim()
                    : "Bearer " + authorizationHeader.trim();
        }
        String token = jwtService.generateAccessToken(subjectUserId, "web", 1L, UserRole.ADMIN.name());
        return "Bearer " + token;
    }

    private PrescriptionValidationJpaEntity mapToEntity(
            Map<String, Object> ragResult,
            String source,
            UUID patientPrescriptionExternalId,
            UUID structuredPrescriptionExternalId,
            ChildContext child
    ) {
        PrescriptionValidationJpaEntity row = new PrescriptionValidationJpaEntity();
        row.setPrescriptionSource(source);
        row.setPatientPrescriptionExternalId(patientPrescriptionExternalId);
        row.setStructuredPrescriptionExternalId(structuredPrescriptionExternalId);
        if (child.childProfileExternalId() != null) {
            row.setChildProfileExternalId(child.childProfileExternalId());
        }
        if (child.weightKg() != null) {
            row.setChildWeightKgUsed(BigDecimal.valueOf(child.weightKg()));
        }
        row.setWeightSource(child.weightSource());
        row.setOverallRiskLevel(stringVal(ragResult, "OverallRiskLevel", "none"));
        row.setLlmSummary(stringVal(ragResult, "LlmSummary", ""));
        row.setUnrecognizedDrugs(stringList(ragResult.get("UnrecognizedDrugs")));
        row.setInteractionFindings(objectList(ragResult.get("InteractionFindings")));
        row.setDosageFindings(objectList(ragResult.get("DosageFindings")));
        return row;
    }

    private void maybeNotify(PatientPrescriptionJpaEntity rx, PrescriptionValidationJpaEntity validation) {
        String risk = validation.getOverallRiskLevel();
        if (risk == null || (!"high".equalsIgnoreCase(risk) && !"critical".equalsIgnoreCase(risk))) {
            return;
        }
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("prescriptionId", rx.getExternalId().toString());
        context.put("patientName", Objects.toString(rx.getPatientName(), ""));
        context.put("doctorId", Objects.toString(rx.getDoctorId(), ""));
        context.put("riskLevel", risk);
        context.put("summary", Objects.toString(validation.getLlmSummary(), ""));
        NotificationTriggerSupport.triggerSafely(
                notificationService,
                "PRESCRIPTION_SAFETY_ALERT",
                rx.getPatientUserId(),
                context
        );
    }

    private PrescriptionValidationResponse toResponse(PrescriptionValidationJpaEntity row) {
        PrescriptionValidationResponse response = new PrescriptionValidationResponse();
        response.setExternalId(row.getExternalId());
        response.setPrescriptionSource(row.getPrescriptionSource());
        response.setPatientPrescriptionExternalId(row.getPatientPrescriptionExternalId());
        response.setStructuredPrescriptionExternalId(row.getStructuredPrescriptionExternalId());
        response.setChildProfileExternalId(row.getChildProfileExternalId());
        response.setChildWeightKgUsed(row.getChildWeightKgUsed());
        response.setWeightSource(row.getWeightSource());
        response.setOverallRiskLevel(row.getOverallRiskLevel());
        response.setLlmSummary(row.getLlmSummary());
        response.setUnrecognizedDrugs(row.getUnrecognizedDrugs());
        response.setReviewedByDoctor(row.isReviewedByDoctor());
        response.setReviewedAt(row.getReviewedAt());
        response.setCreatedAt(row.getCreatedAt());
        response.setInteractionFindings(mapInteractions(row.getInteractionFindings()));
        response.setDosageFindings(mapDosages(row.getDosageFindings()));
        return response;
    }

    @SuppressWarnings("unchecked")
    private List<PrescriptionInteractionFindingDto> mapInteractions(List<Map<String, Object>> raw) {
        List<PrescriptionInteractionFindingDto> out = new ArrayList<>();
        if (raw == null) {
            return out;
        }
        for (Map<String, Object> item : raw) {
            PrescriptionInteractionFindingDto dto = new PrescriptionInteractionFindingDto();
            dto.setDrugA(stringVal(item, "DrugA", ""));
            dto.setDrugB(stringVal(item, "DrugB", ""));
            dto.setSeverity(stringVal(item, "Severity", ""));
            dto.setMechanism(stringVal(item, "Mechanism", ""));
            dto.setClinicalEffect(stringVal(item, "ClinicalEffect", ""));
            dto.setManagement(stringVal(item, "Management", ""));
            dto.setSource(stringVal(item, "Source", ""));
            dto.setDrugsFrom(stringVal(item, "DrugsFrom", ""));
            out.add(dto);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private List<PrescriptionDosageFindingDto> mapDosages(List<Map<String, Object>> raw) {
        List<PrescriptionDosageFindingDto> out = new ArrayList<>();
        if (raw == null) {
            return out;
        }
        for (Map<String, Object> item : raw) {
            PrescriptionDosageFindingDto dto = new PrescriptionDosageFindingDto();
            dto.setGenericName(stringVal(item, "GenericName", ""));
            dto.setStatus(stringVal(item, "Status", ""));
            dto.setMessage(stringVal(item, "Message", ""));
            dto.setPrescribedDoseMg(toBigDecimal(item.get("PrescribedDoseMg")));
            dto.setPrescribedDailyTotalMg(toBigDecimal(item.get("PrescribedDailyTotalMg")));
            dto.setMaxSafeDailyMg(toBigDecimal(item.get("MaxSafeDailyMg")));
            Object range = item.get("ExpectedDoseRangeMg");
            if (range instanceof List<?> list) {
                List<BigDecimal> values = new ArrayList<>();
                for (Object val : list) {
                    BigDecimal bd = toBigDecimal(val);
                    if (bd != null) {
                        values.add(bd);
                    }
                }
                dto.setExpectedDoseRangeMg(values);
            }
            Object ageOk = item.get("AgeAppropriate");
            if (ageOk instanceof Boolean b) {
                dto.setAgeAppropriate(b);
            }
            out.add(dto);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> objectList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> copy = new LinkedHashMap<>();
                map.forEach((k, v) -> copy.put(String.valueOf(k), v));
                out.add(copy);
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<String> stringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            if (item != null) {
                out.add(item.toString());
            }
        }
        return out;
    }

    private static String stringVal(Map<String, Object> map, String key, String fallback) {
        Object val = map.get(key);
        return val == null ? fallback : val.toString();
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal bd) {
            return bd;
        }
        if (value instanceof Number num) {
            return BigDecimal.valueOf(num.doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private record ChildContext(
            UUID childProfileExternalId,
            Double weightKg,
            Double ageMonths,
            Double temperatureF,
            String weightSource
    ) {
    }
}
