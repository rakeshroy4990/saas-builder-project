package com.flexshell.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.PdfRagTriageAdapter;
import com.flexshell.ai.PdfRagTriageAdapter.TriageAnalysisResult;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.PagedTriageResultListDto;
import com.flexshell.controller.dto.TriageAnalyzeRequest;
import com.flexshell.controller.dto.TriageResultResponse;
import com.flexshell.controller.dto.TriageResultSaveRequest;
import com.flexshell.http.NdjsonStreamWriter;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.model.TriageResultJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.TriageResultJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class TriageResultService {

    private static final Logger LOG = LoggerFactory.getLogger(TriageResultService.class);
    private static final Set<String> VALID_SEVERITIES = Set.of("MILD", "MODERATE", "SEVERE");
    private static final Set<String> VALID_URGENCY = Set.of("HOME_CARE", "CLINIC_VISIT", "EMERGENCY");
    private static final Set<String> EMERGENCY_SYMPTOM_TERMS = Set.of(
            "seizure", "convulsion", "breathing difficulty", "breathless", "not breathing"
    );

    private final TriageResultJpaRepository triageRepository;
    private final UserJpaRepository userRepository;
    private final AppointmentJpaRepository appointmentRepository;
    private final PdfRagTriageAdapter triageAdapter;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final int freshnessHours;

    public TriageResultService(
            TriageResultJpaRepository triageRepository,
            UserJpaRepository userRepository,
            AppointmentJpaRepository appointmentRepository,
            PdfRagTriageAdapter triageAdapter,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            @Value("${app.triage.freshness-hours:24}") int freshnessHours
    ) {
        this.triageRepository = triageRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.triageAdapter = triageAdapter;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.freshnessHours = Math.max(1, freshnessHours);
    }

    @Transactional
    public TriageResultResponse analyze(String actorUserId, TriageAnalyzeRequest request, String authorizationHeader) {
        long requestStartMs = System.currentTimeMillis();
        ensurePatient(actorUserId);
        validateAnalyzeRequest(request);

        List<String> symptoms = sanitizeSymptoms(request.getReportedSymptoms());
        if (symptoms.isEmpty()) {
            throw new IllegalArgumentException("TRIAGE_SYMPTOMS_REQUIRED");
        }

        int ageMonths = request.getChildAgeMonths();
        String severity = normalizeSeverity(request.getSymptomSeverity());

        LOG.info(
                "triage_analyze_json_start actorId={} ageMonths={} symptomCount={} severity={}",
                actorUserId,
                ageMonths,
                symptoms.size(),
                severity
        );

        long ragStartMs = System.currentTimeMillis();
        TriageAnalysisResult analysis = triageAdapter.analyze(
                ageMonths,
                request.getChildWeightKg(),
                symptoms,
                request.getSymptomDurationHours(),
                severity,
                request.getAdditionalNotes(),
                authorizationHeader
        );
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "rag_blocking_analyze", ragStartMs,
                "urgency=" + analysis.urgencyLevel());

        long safetyStartMs = System.currentTimeMillis();
        TriageAnalysisResult safe = applySafetyOverrides(ageMonths, symptoms, analysis);
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "safety_overrides", safetyStartMs, "urgency=" + safe.urgencyLevel());

        long persistStartMs = System.currentTimeMillis();
        TriageResultJpaEntity saved = saveAnalyzedResult(actorUserId, request, symptoms, ageMonths, severity, safe);
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "persist", persistStartMs, "externalId=" + saved.getExternalId());

        LOG.info(
                "triage_analyze_json_complete actorId={} totalMs={} urgency={} externalId={}",
                actorUserId,
                System.currentTimeMillis() - requestStartMs,
                safe.urgencyLevel(),
                saved.getExternalId()
        );
        return toResponse(saved);
    }

    /**
     * NDJSON stream: proxies pdf-rag triage stream, persists on {@code complete}, rewrites complete with saved row.
     */
    public StreamingResponseBody streamAnalyze(String actorUserId, TriageAnalyzeRequest request, String authorizationHeader) {
        ensurePatient(actorUserId);
        validateAnalyzeRequest(request);

        List<String> symptoms = sanitizeSymptoms(request.getReportedSymptoms());
        if (symptoms.isEmpty()) {
            throw new IllegalArgumentException("TRIAGE_SYMPTOMS_REQUIRED");
        }

        int ageMonths = request.getChildAgeMonths();
        String severity = normalizeSeverity(request.getSymptomSeverity());

        LOG.info(
                "triage_analyze_stream_start actorId={} ageMonths={} symptomCount={} severity={}",
                actorUserId,
                ageMonths,
                symptoms.size(),
                severity
        );

        return outputStream -> {
            TriageAnalyzeTiming timing = new TriageAnalyzeTiming();
            AtomicBoolean terminalEventSent = new AtomicBoolean(false);
            try {
                NdjsonStreamWriter.writeReady(outputStream, objectMapper);
                timing.markReady();
                LOG.info("triage_analyze_stream_ready actorId={} readyMs={}", actorUserId, timing.elapsed());

                long ragStreamStartMs = System.currentTimeMillis();
                try {
                    triageAdapter.streamAnalyzeNdjson(
                            ageMonths,
                            request.getChildWeightKg(),
                            symptoms,
                            request.getSymptomDurationHours(),
                            severity,
                            request.getAdditionalNotes(),
                            authorizationHeader,
                            line -> {
                                try {
                                    timing.markFirstRagLine();
                                    timing.incrementLine();
                                    handleStreamLine(
                                            outputStream,
                                            terminalEventSent,
                                            timing,
                                            actorUserId,
                                            request,
                                            symptoms,
                                            ageMonths,
                                            severity,
                                            line
                                    );
                                } catch (IOException ex) {
                                    throw new UncheckedIOException(ex);
                                }
                            }
                    );
                    TriageAnalyzeTiming.logStep(LOG, actorUserId, "rag_ndjson_proxy", ragStreamStartMs,
                            "lineCount=" + timing.ragLineCount());
                } catch (Exception ex) {
                    LOG.warn(
                            "triage_rag_stream_unavailable actorId={} type={} message={} elapsedMs={}",
                            actorUserId,
                            ex.getClass().getSimpleName(),
                            ex.getMessage(),
                            timing.elapsed()
                    );
                }
                if (!terminalEventSent.get()) {
                    timing.markSyncFallbackStart();
                    LOG.info("triage_analyze_stream_sync_fallback actorId={} startMs={}", actorUserId, timing.elapsed());
                    streamAnalyzeSyncFallback(
                            outputStream,
                            terminalEventSent,
                            timing,
                            actorUserId,
                            request,
                            symptoms,
                            ageMonths,
                            severity,
                            authorizationHeader
                    );
                }
            } catch (IllegalArgumentException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), code(ex));
            } catch (SecurityException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), "TRIAGE_RESULT_FORBIDDEN");
            } catch (UncheckedIOException ex) {
                if (!terminalEventSent.get()) {
                    writeStreamError(
                            outputStream,
                            terminalEventSent,
                            "Triage stream was interrupted.",
                            "TRIAGE_STREAM_INTERRUPTED"
                    );
                }
            } catch (Exception ex) {
                LOG.warn(
                        "triage_stream_failed actorId={} type={} elapsedMs={}",
                        actorUserId,
                        ex.getClass().getSimpleName(),
                        timing.elapsed()
                );
                if (!terminalEventSent.get()) {
                    writeStreamError(
                            outputStream,
                            terminalEventSent,
                            "Triage analysis failed.",
                            "TRIAGE_ANALYSIS_UNAVAILABLE"
                    );
                }
            } finally {
                if (!terminalEventSent.get()) {
                    try {
                        writeStreamError(
                                outputStream,
                                terminalEventSent,
                                "Triage stream ended before a result was available.",
                                "TRIAGE_STREAM_INCOMPLETE"
                        );
                    } catch (Exception ex) {
                        LOG.debug("triage_stream_terminal_fallback_failed actorId={} msg={}", actorUserId, ex.getMessage());
                    }
                }
                timing.logSummary(LOG, actorUserId, symptoms.size(), "ndjson");
            }
        };
    }

    /**
     * Runs blocking pdf-rag analyze while still emitting NDJSON status/delta chunks, then persists and completes.
     */
    private void streamAnalyzeSyncFallback(
            OutputStream outputStream,
            AtomicBoolean terminalEventSent,
            TriageAnalyzeTiming timing,
            String actorUserId,
            TriageAnalyzeRequest request,
            List<String> symptoms,
            int ageMonths,
            String severity,
            String authorizationHeader
    ) throws IOException {
        if (terminalEventSent.get()) {
            return;
        }
        NdjsonStreamWriter.writeStatus(outputStream, objectMapper, "retrieving");
        timing.markFirstStatus();
        NdjsonStreamWriter.writeTextDelta(outputStream, "Reviewing pediatric references for your symptoms…");

        long ragStartMs = System.currentTimeMillis();
        AtomicBoolean heartbeatRunning = new AtomicBoolean(true);
        Thread heartbeat = new Thread(() -> {
            while (heartbeatRunning.get()) {
                try {
                    Thread.sleep(2_000L);
                    if (!heartbeatRunning.get()) {
                        break;
                    }
                    NdjsonStreamWriter.writePing(outputStream, objectMapper, "retrieving");
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (IOException ex) {
                    LOG.debug("triage_analyze_stream_ping_stopped actorId={} reason=io", actorUserId);
                    break;
                }
            }
        }, "triage-analyze-heartbeat");
        heartbeat.setDaemon(true);
        heartbeat.start();
        TriageAnalysisResult analysis;
        try {
            analysis = triageAdapter.analyze(
                    ageMonths,
                    request.getChildWeightKg(),
                    symptoms,
                    request.getSymptomDurationHours(),
                    severity,
                    request.getAdditionalNotes(),
                    authorizationHeader
            );
        } finally {
            heartbeatRunning.set(false);
            heartbeat.interrupt();
        }
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "sync_fallback_rag_analyze", ragStartMs,
                "urgency=" + analysis.urgencyLevel());

        long safetyStartMs = System.currentTimeMillis();
        TriageAnalysisResult safe = applySafetyOverrides(ageMonths, symptoms, analysis);
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "sync_fallback_safety", safetyStartMs, "urgency=" + safe.urgencyLevel());

        NdjsonStreamWriter.writeStatus(outputStream, objectMapper, "generating");
        long deltaStartMs = System.currentTimeMillis();
        writeReasoningDeltas(outputStream, timing, safe.urgencyReasoning());
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "sync_fallback_emit_deltas", deltaStartMs, null);

        long persistStartMs = System.currentTimeMillis();
        TriageResultResponse response = transactionTemplate.execute(status ->
                toResponse(saveAnalyzedResult(actorUserId, request, symptoms, ageMonths, severity, safe))
        );
        timing.markPersist();
        TriageAnalyzeTiming.logStep(LOG, actorUserId, "sync_fallback_persist", persistStartMs,
                response == null ? "failed" : "externalId=" + response.getExternalId());

        if (response == null) {
            throw new IllegalStateException("Failed to persist triage result");
        }
        writeCompleteRow(outputStream, response);
        terminalEventSent.set(true);
        timing.markComplete("sync_fallback");
        LOG.info(
                "triage_analyze_stream_sync_fallback_complete actorId={} totalMs={} externalId={} urgency={}",
                actorUserId,
                timing.elapsed(),
                response.getExternalId(),
                response.getUrgencyLevel()
        );
    }

    private void writeReasoningDeltas(OutputStream outputStream, TriageAnalyzeTiming timing, String reasoning) throws IOException {
        String text = reasoning == null ? "" : reasoning.trim();
        if (text.isBlank()) {
            return;
        }
        int step = 80;
        for (int i = 0; i < text.length(); i += step) {
            String chunk = text.substring(i, Math.min(i + step, text.length()));
            timing.markFirstDelta();
            NdjsonStreamWriter.writeTextDelta(outputStream, chunk);
        }
    }

    private void writeCompleteRow(OutputStream outputStream, TriageResultResponse response) throws IOException {
        Map<String, Object> data = new LinkedHashMap<>();
        if (response.getExternalId() != null) {
            data.put("ExternalId", response.getExternalId().toString());
        }
        data.put("UrgencyLevel", response.getUrgencyLevel());
        data.put("UrgencyReasoning", response.getUrgencyReasoning());
        data.put("DoctorNote", response.getDoctorNote());
        data.put("RedFlags", response.getRedFlags());
        if (response.getConfidence() != null) {
            data.put("Confidence", response.getConfidence());
        }
        if (response.getCreatedAt() != null) {
            data.put("CreatedAt", response.getCreatedAt());
        }
        NdjsonStreamWriter.writeLine(outputStream, objectMapper, "complete", data);
        LOG.info("triage_analyze_stream_complete_written externalId={}", response.getExternalId());
    }

    private static String ndjsonEventType(JsonNode root) {
        String type = root.path("type").asText("").trim();
        if (type.isBlank()) {
            type = root.path("Type").asText("").trim();
        }
        return type.toLowerCase(Locale.ROOT);
    }

    private static JsonNode ndjsonEventData(JsonNode root) {
        JsonNode data = root.get("data");
        return data != null && !data.isNull() ? data : root.get("Data");
    }

    private void handleStreamLine(
            OutputStream outputStream,
            AtomicBoolean terminalEventSent,
            TriageAnalyzeTiming timing,
            String actorUserId,
            TriageAnalyzeRequest request,
            List<String> symptoms,
            int ageMonths,
            String severity,
            String line
    ) throws IOException {
        JsonNode root = objectMapper.readTree(line);
        String type = ndjsonEventType(root);
        if ("error".equals(type)) {
            JsonNode data = ndjsonEventData(root);
            String msg = data == null ? "TRIAGE_ANALYSIS_UNAVAILABLE" : data.path("message").asText("TRIAGE_ANALYSIS_UNAVAILABLE");
            LOG.warn("triage_analyze_stream_error actorId={} message={} elapsedMs={}", actorUserId, msg, timing.elapsed());
            writeStreamError(outputStream, terminalEventSent, msg, msg);
            timing.markComplete("rag_error");
            return;
        }
        if ("complete".equals(type)) {
            JsonNode data = ndjsonEventData(root);
            if (data == null || !data.isObject()) {
                forwardNdjsonLine(outputStream, line);
                terminalEventSent.set(true);
                timing.markComplete("rag_forwarded");
                return;
            }
            long parseStartMs = System.currentTimeMillis();
            @SuppressWarnings("unchecked")
            Map<String, Object> dataMap = objectMapper.convertValue(data, Map.class);
            TriageAnalysisResult analysis = triageAdapter.parseResponseMap(dataMap);
            TriageAnalysisResult safe = applySafetyOverrides(ageMonths, symptoms, analysis);
            TriageAnalyzeTiming.logStep(LOG, actorUserId, "stream_parse_and_safety", parseStartMs,
                    "urgency=" + safe.urgencyLevel());

            long persistStartMs = System.currentTimeMillis();
            TriageResultResponse response = transactionTemplate.execute(status ->
                    toResponse(saveAnalyzedResult(actorUserId, request, symptoms, ageMonths, severity, safe))
            );
            timing.markPersist();
            TriageAnalyzeTiming.logStep(LOG, actorUserId, "stream_persist", persistStartMs,
                    response == null ? "failed" : "externalId=" + response.getExternalId());

            if (response == null) {
                throw new IllegalStateException("Failed to persist triage result");
            }
            writeCompleteRow(outputStream, response);
            terminalEventSent.set(true);
            timing.markComplete("rag_stream");
            LOG.info(
                    "triage_analyze_stream_complete actorId={} totalMs={} externalId={} urgency={}",
                    actorUserId,
                    timing.elapsed(),
                    response.getExternalId(),
                    response.getUrgencyLevel()
            );
            return;
        }
        forwardNdjsonLine(outputStream, line);
        if ("status".equals(type) || "ping".equals(type)) {
            timing.markFirstStatus();
            JsonNode data = ndjsonEventData(root);
            String phase = data == null ? "" : data.path("phase").asText(data.path("Phase").asText("")).trim();
            if (!phase.isBlank()) {
                LOG.info("triage_analyze_stream_status actorId={} phase={} elapsedMs={}", actorUserId, phase, timing.elapsed());
            }
        }
        if ("delta".equals(type) || "token".equals(type)) {
            timing.markFirstDelta();
        }
    }

    private void forwardNdjsonLine(OutputStream outputStream, String line) throws IOException {
        outputStream.write((line + "\n").getBytes(StandardCharsets.UTF_8));
        outputStream.flush();
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
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    private TriageResultJpaEntity saveAnalyzedResult(
            String actorUserId,
            TriageAnalyzeRequest request,
            List<String> symptoms,
            int ageMonths,
            String severity,
            TriageAnalysisResult safe
    ) {
        TriageResultJpaEntity row = new TriageResultJpaEntity();
        row.setPatientUserId(actorUserId);
        row.setChildDisplayName(trimToNull(request.getChildDisplayName()));
        row.setChildAgeMonths(ageMonths);
        row.setChildWeightKg(request.getChildWeightKg());
        row.setReportedSymptoms(symptoms.toArray(String[]::new));
        row.setSymptomDurationHours(request.getSymptomDurationHours());
        row.setSymptomSeverity(severity);
        row.setAdditionalNotes(trimToNull(request.getAdditionalNotes()));
        row.setUrgencyLevel(safe.urgencyLevel());
        row.setUrgencyReasoning(safe.urgencyReasoning());
        row.setDoctorNote(safe.doctorNote());
        row.setRedFlags(safe.redFlags().toArray(String[]::new));
        row.setConfidence(safe.confidence());
        row.setModelUsed(safe.modelUsed());
        row.setRagChunksUsed(safe.ragChunksUsed());
        row.setDeleted(false);

        UUID appointmentExternalId = request.getAppointmentExternalId();
        if (appointmentExternalId != null) {
            ensureAppointmentAccessible(actorUserId, appointmentExternalId);
            row.setAppointmentExternalId(appointmentExternalId);
        }

        TriageResultJpaEntity saved = triageRepository.save(row);
        LOG.info(
                "triage_result_saved age_bucket={} symptom_count={} urgency={}",
                ageBucket(ageMonths),
                symptoms.size(),
                safe.urgencyLevel()
        );
        return saved;
    }

    private static String code(IllegalArgumentException ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? "TRIAGE_RESULT_INVALID" : message.trim();
    }

    @Transactional(readOnly = true)
    public Optional<TriageResultResponse> findLatestForAppointmentBusinessId(String appointmentBusinessId) {
        if (appointmentBusinessId == null || appointmentBusinessId.isBlank()) {
            return Optional.empty();
        }
        return appointmentRepository.findById(appointmentBusinessId.trim())
                .filter(row -> !row.isDeleted())
                .map(AppointmentJpaEntity::getExternalId)
                .flatMap(this::findLatestForAppointment);
    }

    @Transactional(readOnly = true)
    public Optional<TriageResultResponse> findLatestForAppointment(UUID appointmentExternalId) {
        if (appointmentExternalId == null) {
            return Optional.empty();
        }
        return triageRepository
                .findFirstByAppointmentExternalIdAndDeletedFalseOrderByCreatedAtDesc(appointmentExternalId)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Optional<TriageResultResponse> findLatestForPatient(String patientUserId, Duration within) {
        if (patientUserId == null || patientUserId.isBlank()) {
            return Optional.empty();
        }
        Duration window = within == null ? Duration.ofHours(freshnessHours) : within;
        Instant after = Instant.now().minus(window);
        return triageRepository
                .findFirstByPatientUserIdAndCreatedAtAfterAndDeletedFalseOrderByCreatedAtDesc(patientUserId, after)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TriageResultResponse getForAppointment(String actorUserId, UUID appointmentExternalId) {
        ensureCanReadTriage(actorUserId, appointmentExternalId);
        return findLatestForAppointment(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("TRIAGE_RESULT_NOT_FOUND"));
    }

    @Transactional(readOnly = true)
    public TriageResultResponse getForAppointmentBusinessId(String actorUserId, String appointmentBusinessId) {
        AppointmentJpaEntity appointment = appointmentRepository.findById(normalize(appointmentBusinessId))
                .filter(row -> !row.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        ensureCanReadTriage(actorUserId, appointment.getExternalId());
        return findLatestForAppointment(appointment.getExternalId())
                .orElseThrow(() -> new IllegalArgumentException("TRIAGE_RESULT_NOT_FOUND"));
    }

    @Transactional(readOnly = true)
    public PagedTriageResultListDto listForPatient(String actorUserId, int page, int size) {
        ensurePatient(actorUserId);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<TriageResultJpaEntity> rows = triageRepository.findByPatientUserIdAndDeletedFalse(actorUserId, pageable);
        List<TriageResultResponse> content = rows.getContent().stream().map(this::toResponse).collect(Collectors.toList());
        return new PagedTriageResultListDto(content, rows.getNumber(), rows.getSize(), rows.getTotalElements());
    }

    @Transactional
    public TriageResultResponse save(String actorUserId, TriageResultSaveRequest request) {
        ensurePatient(actorUserId);
        if (request == null || request.getExternalId() == null) {
            throw new IllegalArgumentException("TRIAGE_RESULT_EXTERNAL_ID_REQUIRED");
        }
        if (request.getAppointmentExternalId() == null) {
            throw new IllegalArgumentException("TRIAGE_APPOINTMENT_EXTERNAL_ID_REQUIRED");
        }
        return linkToAppointment(actorUserId, request.getExternalId(), request.getAppointmentExternalId());
    }

    @Transactional
    public TriageResultResponse linkToAppointment(String actorUserId, UUID triageExternalId, UUID appointmentExternalId) {
        ensurePatient(actorUserId);
        TriageResultJpaEntity row = triageRepository.findByExternalIdAndDeletedFalse(triageExternalId)
                .orElseThrow(() -> new IllegalArgumentException("TRIAGE_RESULT_NOT_FOUND"));
        if (!actorUserId.equals(row.getPatientUserId())) {
            throw new SecurityException("You do not have access to this triage result");
        }
        AppointmentJpaEntity appointment = appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        if (!actorUserId.equals(normalize(appointment.getCreatedBy()))) {
            throw new SecurityException("You do not have access to this appointment");
        }

        row.setAppointmentExternalId(appointmentExternalId);
        TriageResultJpaEntity saved = triageRepository.save(row);

        String prefix = "[Pre-consultation triage]\n" + normalize(saved.getDoctorNote());
        String existingNotes = normalize(appointment.getAdditionalNotes());
        if (!existingNotes.contains(prefix)) {
            appointment.setAdditionalNotes(existingNotes.isBlank() ? prefix : existingNotes + "\n\n" + prefix);
            appointmentRepository.save(appointment);
        }
        return toResponse(saved);
    }

    @Transactional
    public void deleteByBusinessKey(String actorUserId, UUID externalId) {
        ensurePatient(actorUserId);
        TriageResultJpaEntity row = triageRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("TRIAGE_RESULT_NOT_FOUND"));
        if (!actorUserId.equals(row.getPatientUserId())) {
            throw new SecurityException("You do not have access to this triage result");
        }
        row.setDeleted(true);
        triageRepository.save(row);
    }

    public void maybeLinkOnAppointmentCreate(String actorUserId, UUID triageExternalId, String appointmentBusinessId) {
        if (triageExternalId == null || appointmentBusinessId == null || appointmentBusinessId.isBlank()) {
            return;
        }
        try {
            AppointmentJpaEntity appointment = appointmentRepository.findById(appointmentBusinessId.trim())
                    .filter(row -> !row.isDeleted())
                    .orElse(null);
            if (appointment == null || appointment.getExternalId() == null) {
                return;
            }
            linkToAppointment(actorUserId, triageExternalId, appointment.getExternalId());
        } catch (Exception ex) {
            LOG.warn("triage_link_on_appointment_create_failed triageId={} appointmentId={} reason={}",
                    triageExternalId, appointmentBusinessId, ex.getMessage());
        }
    }

    private void validateAnalyzeRequest(TriageAnalyzeRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("TRIAGE_REQUEST_REQUIRED");
        }
        if (request.getChildAgeMonths() == null || request.getChildAgeMonths() < 0) {
            throw new IllegalArgumentException("TRIAGE_CHILD_AGE_REQUIRED");
        }
        String severity = normalizeSeverity(request.getSymptomSeverity());
        if (!VALID_SEVERITIES.contains(severity)) {
            throw new IllegalArgumentException("TRIAGE_SEVERITY_INVALID");
        }
    }

    private TriageAnalysisResult applySafetyOverrides(int ageMonths, List<String> symptoms, TriageAnalysisResult analysis) {
        String urgency = normalizeUrgency(analysis.urgencyLevel());
        String reasoning = normalize(analysis.urgencyReasoning());
        List<String> redFlags = new ArrayList<>(analysis.redFlags() == null ? List.of() : analysis.redFlags());
        String confidence = normalize(analysis.confidence()).toUpperCase(Locale.ROOT);
        if (confidence.isBlank()) {
            confidence = "LOW";
        }

        if (containsEmergencySymptom(symptoms)) {
            urgency = "EMERGENCY";
            if (redFlags.stream().noneMatch(flag -> flag.toLowerCase(Locale.ROOT).contains("emergency"))) {
                redFlags.add(0, "Emergency symptom reported");
            }
        }
        if (ageMonths < 3 && "HOME_CARE".equals(urgency)) {
            urgency = "CLINIC_VISIT";
            reasoning = reasoning + " Neonates require in-person clinical assessment.";
        }
        if (!redFlags.isEmpty() && "HOME_CARE".equals(urgency)) {
            urgency = "CLINIC_VISIT";
        }
        if ("LOW".equals(confidence) && !reasoning.contains("Limited clinical reference data")) {
            reasoning = reasoning + " Limited clinical reference data was available for this assessment; please treat this as preliminary guidance.";
        }

        return new TriageAnalysisResult(
                urgency,
                reasoning.trim(),
                normalize(analysis.doctorNote()),
                redFlags,
                confidence,
                normalize(analysis.modelUsed()),
                analysis.ragChunksUsed() == null ? List.of() : analysis.ragChunksUsed()
        );
    }

    private void ensurePatient(String actorUserId) {
        UserRole role = resolveRole(actorUserId);
        if (role != UserRole.PATIENT) {
            throw new SecurityException("Only patients can perform symptom triage.");
        }
    }

    private void ensureCanReadTriage(String actorUserId, UUID appointmentExternalId) {
        UserRole role = resolveRole(actorUserId);
        if (role == UserRole.ADMIN) {
            return;
        }
        AppointmentJpaEntity appointment = appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        if (role == UserRole.DOCTOR && actorUserId.equals(normalize(appointment.getDoctorId()))) {
            return;
        }
        if (role == UserRole.PATIENT && actorUserId.equals(normalize(appointment.getCreatedBy()))) {
            return;
        }
        throw new SecurityException("You do not have access to this triage result");
    }

    private void ensureAppointmentAccessible(String actorUserId, UUID appointmentExternalId) {
        AppointmentJpaEntity appointment = appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        if (!actorUserId.equals(normalize(appointment.getCreatedBy()))) {
            throw new SecurityException("You do not have access to this appointment");
        }
    }

    private UserRole resolveRole(String actorUserId) {
        UserJpaEntity user = userRepository.findById(actorUserId)
                .orElseThrow(() -> new SecurityException("User not found"));
        return user.getRole() == null ? UserRole.PATIENT : user.getRole();
    }

    private static List<String> sanitizeSymptoms(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String item : raw) {
            if (out.size() >= 20) {
                break;
            }
            String text = normalize(item);
            if (text.isBlank()) {
                continue;
            }
            if (text.length() > 100) {
                text = text.substring(0, 100);
            }
            out.add(text);
        }
        return new ArrayList<>(out);
    }

    private static boolean containsEmergencySymptom(List<String> symptoms) {
        String blob = symptoms.stream().map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.joining(" "));
        for (String term : EMERGENCY_SYMPTOM_TERMS) {
            if (blob.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeSeverity(String severity) {
        return normalize(severity).toUpperCase(Locale.ROOT);
    }

    private static String normalizeUrgency(String urgency) {
        String value = normalize(urgency).toUpperCase(Locale.ROOT);
        return VALID_URGENCY.contains(value) ? value : "CLINIC_VISIT";
    }

    private static String ageBucket(int months) {
        if (months < 3) {
            return "neonate";
        }
        if (months < 12) {
            return "infant";
        }
        if (months < 60) {
            return "toddler";
        }
        return "child";
    }

    private static String trimToNull(String value) {
        String trimmed = normalize(value);
        return trimmed.isBlank() ? null : trimmed;
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }

    private TriageResultResponse toResponse(TriageResultJpaEntity row) {
        TriageResultResponse response = new TriageResultResponse();
        response.setExternalId(row.getExternalId());
        response.setAppointmentExternalId(row.getAppointmentExternalId());
        response.setPatientUserId(row.getPatientUserId());
        response.setChildDisplayName(row.getChildDisplayName());
        response.setChildAgeMonths(row.getChildAgeMonths());
        response.setChildWeightKg(row.getChildWeightKg());
        response.setReportedSymptoms(Arrays.asList(row.getReportedSymptoms()));
        response.setSymptomDurationHours(row.getSymptomDurationHours());
        response.setSymptomSeverity(row.getSymptomSeverity());
        response.setAdditionalNotes(row.getAdditionalNotes());
        response.setUrgencyLevel(row.getUrgencyLevel());
        response.setUrgencyReasoning(row.getUrgencyReasoning());
        response.setDoctorNote(row.getDoctorNote());
        response.setRedFlags(Arrays.asList(row.getRedFlags()));
        response.setConfidence(row.getConfidence());
        response.setModelUsed(row.getModelUsed());
        response.setRagChunksUsed(row.getRagChunksUsed());
        response.setCreatedAt(row.getCreatedAt() == null ? null : row.getCreatedAt().toString());
        return response;
    }
}
