package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiEmbeddingAdapter;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityDetailsResponse;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityHitResponse;
import com.flexshell.controller.dto.PatientPrescriptionSimilaritySectionScoreResponse;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import com.flexshell.http.NdjsonStreamWriter;
import com.flexshell.prescription.PatientPrescriptionExtractedJsonReader;
import com.flexshell.prescription.PatientPrescriptionSectionSimilarity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class PatientPrescriptionSimilarityService {

    private static final Logger LOG = LoggerFactory.getLogger(PatientPrescriptionSimilarityService.class);

    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 20;
    private static final int MAX_QUERY_CHARS = 12_000;

    private static final String SELECT_CORE = """
            SELECT p.external_id,
                   p.status,
                   p.patient_name,
                   p.doctor_name,
                   p.department,
                   p.patient_gender,
                   p.search_text,
                   p.extracted_data::text AS extracted_data,
                   p.created_at,
                   ROUND((1 - (p.embedding <=> ?::halfvec(3072)))::numeric * 100, 1) AS match_percent
            FROM patient_prescriptions p
            WHERE p.deleted = false
              AND p.embedding IS NOT NULL
            """;

    private final JdbcTemplate jdbcTemplate;
    private final OpenAiEmbeddingAdapter embeddingAdapter;
    private final EducationPrescriptionTranscriptionService transcriptionService;
    private final UserJpaRepository userRepository;
    private final ObjectMapper objectMapper;

    public PatientPrescriptionSimilarityService(
            JdbcTemplate jdbcTemplate,
            OpenAiEmbeddingAdapter embeddingAdapter,
            EducationPrescriptionTranscriptionService transcriptionService,
            UserJpaRepository userRepository,
            ObjectMapper objectMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingAdapter = embeddingAdapter;
        this.transcriptionService = transcriptionService;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<PatientPrescriptionSimilarityHitResponse> search(
            String actorUserId,
            MultipartFile file,
            String queryText,
            int limit
    ) {
        return executeSearch(actorUserId, file, queryText, limit, null, null);
    }

    /**
     * NDJSON stream: {@code ready}, {@code status} phases, one {@code hit} per matched prescription, then {@code complete}.
     */
    public StreamingResponseBody streamSearch(
            String actorUserId,
            MultipartFile file,
            String queryText,
            int limit
    ) {
        return outputStream -> {
            AtomicBoolean terminalEventSent = new AtomicBoolean(false);
            try {
                NdjsonStreamWriter.writeReady(outputStream, objectMapper);
                executeSearch(actorUserId, file, queryText, limit, outputStream, terminalEventSent);
            } catch (IllegalArgumentException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), "PATIENT_PRESCRIPTION_SIMILARITY_INVALID");
            } catch (SecurityException ex) {
                writeStreamError(outputStream, terminalEventSent, ex.getMessage(), "PATIENT_PRESCRIPTION_FORBIDDEN");
            } catch (IllegalStateException ex) {
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        ex.getMessage(),
                        "PATIENT_PRESCRIPTION_SIMILARITY_UNAVAILABLE"
                );
            } catch (UncheckedIOException ex) {
                Throwable cause = ex.getCause();
                if (cause instanceof IOException && isClientDisconnect((IOException) cause)) {
                    LOG.debug("patient_prescription_similarity_stream_client_closed actorId={}", actorUserId);
                    return;
                }
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        "Similarity search failed.",
                        "PATIENT_PRESCRIPTION_SIMILARITY_FAILED"
                );
            } catch (Exception ex) {
                LOG.warn(
                        "patient_prescription_similarity_stream_failed actorId={} type={}",
                        actorUserId,
                        ex.getClass().getSimpleName()
                );
                writeStreamError(
                        outputStream,
                        terminalEventSent,
                        "Similarity search failed.",
                        "PATIENT_PRESCRIPTION_SIMILARITY_FAILED"
                );
            } finally {
                if (!terminalEventSent.get()) {
                    try {
                        NdjsonStreamWriter.writeComplete(outputStream, objectMapper, 0);
                    } catch (IOException ex) {
                        LOG.debug(
                                "patient_prescription_similarity_stream_complete_fallback_failed actorId={} msg={}",
                                actorUserId,
                                ex.getMessage()
                        );
                    }
                }
            }
        };
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

    private List<PatientPrescriptionSimilarityHitResponse> executeSearch(
            String actorUserId,
            MultipartFile file,
            String queryText,
            int limit,
            OutputStream streamOut,
            AtomicBoolean terminalEventSent
    ) {
        boolean streaming = streamOut != null;
        try {
            if (streaming && file != null && !file.isEmpty()) {
                NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "transcribing");
            }
            QueryContext query = resolveQueryContext(actorUserId, file, queryText);
            if (query.embedInput().isBlank()) {
                throw new IllegalArgumentException("PATIENT_PRESCRIPTION_SEARCH_INPUT_REQUIRED");
            }
            if (!embeddingAdapter.isConfigured()) {
                throw new IllegalStateException("OpenAI embedding is not configured.");
            }
            if (streaming) {
                NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "embedding");
            }
            List<Double> vector = embeddingAdapter.embedText(query.embedInput());
            if (vector.isEmpty()) {
                throw new IllegalStateException("Could not build query embedding.");
            }
            String vectorLiteral = OpenAiEmbeddingAdapter.toPgVectorLiteral(vector);
            if (vectorLiteral == null) {
                throw new IllegalStateException("Could not build query embedding.");
            }

            int resultLimit = Math.min(MAX_LIMIT, Math.max(1, limit <= 0 ? DEFAULT_LIMIT : limit));
            UserRole role = resolveRole(actorUserId);
            if (streaming) {
                NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "searching");
            }
            String sql = SELECT_CORE + visibilityClause(role) + """
                    ORDER BY p.embedding <=> ?::halfvec(3072)
                    LIMIT ?
                    """;
            Object[] params = buildParams(actorUserId, role, vectorLiteral, resultLimit);

            List<PatientPrescriptionSimilarityHitResponse> hits = jdbcTemplate.query(
                    sql,
                    (rs, rowNum) -> mapRow(rs),
                    params
            );

            if (streaming && !hits.isEmpty()) {
                NdjsonStreamWriter.writeStatus(streamOut, objectMapper, "section_scores");
            }
            List<PatientPrescriptionSimilarityHitResponse> withBreakdown =
                    attachSectionBreakdown(query.details(), hits, streamOut);

            if (withBreakdown.isEmpty()) {
                logEmptySearchDiagnostics(actorUserId, role);
            } else {
                LOG.debug(
                        "patient_prescription_similarity_ok actorId={} role={} queryLen={} hitCount={} topMatch={} stream={}",
                        actorUserId,
                        role,
                        query.embedInput().length(),
                        withBreakdown.size(),
                        withBreakdown.get(0).matchPercent(),
                        streaming
                );
            }
            if (streaming) {
                NdjsonStreamWriter.writeComplete(streamOut, objectMapper, withBreakdown.size());
                if (terminalEventSent != null) {
                    terminalEventSent.set(true);
                }
            }
            return withBreakdown;
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    private static boolean isClientDisconnect(IOException ex) {
        String msg = Objects.toString(ex.getMessage(), "").toLowerCase();
        return msg.contains("broken pipe") || msg.contains("connection reset") || msg.contains("closed");
    }

    private List<PatientPrescriptionSimilarityHitResponse> attachSectionBreakdown(
            PatientPrescriptionSimilarityDetailsResponse queryDetails,
            List<PatientPrescriptionSimilarityHitResponse> hits,
            OutputStream streamOut
    ) throws IOException {
        if (hits.isEmpty()) {
            return hits;
        }
        Map<String, String> querySections = PatientPrescriptionSectionSimilarity.sectionEmbedTexts(queryDetails);
        if (querySections.isEmpty()) {
            return emitHitsForStream(streamOut, hits);
        }
        Map<String, List<Double>> queryVectors = embedSectionsByKey(querySections);
        if (queryVectors.isEmpty()) {
            return emitHitsForStream(streamOut, hits);
        }

        List<String> hitBatchTexts = new ArrayList<>();
        List<HitEmbedSlot> slots = new ArrayList<>();
        for (int hitIndex = 0; hitIndex < hits.size(); hitIndex++) {
            Map<String, String> hitSections = PatientPrescriptionSectionSimilarity.sectionEmbedTexts(hits.get(hitIndex).details());
            for (Map.Entry<String, String> entry : hitSections.entrySet()) {
                String section = entry.getKey();
                if (!querySections.containsKey(section)) {
                    continue;
                }
                hitBatchTexts.add(entry.getValue());
                slots.add(new HitEmbedSlot(hitIndex, section));
            }
        }
        if (hitBatchTexts.isEmpty()) {
            return emitHitsForStream(streamOut, hits);
        }
        List<List<Double>> hitVectors = embeddingAdapter.embedTexts(hitBatchTexts);
        if (hitVectors.size() != hitBatchTexts.size()) {
            LOG.warn(
                    "patient_prescription_similarity_section_embed_mismatch expected={} actual={}",
                    hitBatchTexts.size(),
                    hitVectors.size()
            );
            return emitHitsForStream(streamOut, hits);
        }

        List<List<PatientPrescriptionSimilaritySectionScoreResponse>> breakdownByHit =
                new ArrayList<>(hits.size());
        for (int i = 0; i < hits.size(); i++) {
            breakdownByHit.add(new ArrayList<>());
        }

        for (int i = 0; i < slots.size(); i++) {
            HitEmbedSlot slot = slots.get(i);
            List<Double> hitVec = hitVectors.get(i);
            List<Double> queryVec = queryVectors.get(slot.section());
            if (hitVec == null || hitVec.isEmpty() || queryVec == null || queryVec.isEmpty()) {
                continue;
            }
            double percent = Math.round(
                    PatientPrescriptionSectionSimilarity.cosineSimilarityPercent(queryVec, hitVec) * 10.0
            ) / 10.0;
            breakdownByHit.get(slot.hitIndex()).add(
                    new PatientPrescriptionSimilaritySectionScoreResponse(slot.section(), percent)
            );
        }

        for (List<PatientPrescriptionSimilaritySectionScoreResponse> scores : breakdownByHit) {
            scores.sort((a, b) -> sectionOrderIndex(a.section()) - sectionOrderIndex(b.section()));
        }

        List<PatientPrescriptionSimilarityHitResponse> result = new ArrayList<>(hits.size());
        for (int i = 0; i < hits.size(); i++) {
            PatientPrescriptionSimilarityHitResponse hit = hits.get(i);
            PatientPrescriptionSimilarityHitResponse enriched = new PatientPrescriptionSimilarityHitResponse(
                    hit.externalId(),
                    hit.matchPercent(),
                    hit.status(),
                    hit.patientName(),
                    hit.doctorName(),
                    hit.department(),
                    hit.gender(),
                    hit.searchText(),
                    hit.details(),
                    List.copyOf(breakdownByHit.get(i)),
                    hit.createdAt()
            );
            result.add(enriched);
            if (streamOut != null) {
                NdjsonStreamWriter.writeLine(streamOut, objectMapper, "hit", enriched);
            }
        }
        return result;
    }

    private List<PatientPrescriptionSimilarityHitResponse> emitHitsForStream(
            OutputStream streamOut,
            List<PatientPrescriptionSimilarityHitResponse> hits
    ) throws IOException {
        if (streamOut == null) {
            return hits;
        }
        for (PatientPrescriptionSimilarityHitResponse hit : hits) {
            NdjsonStreamWriter.writeLine(streamOut, objectMapper, "hit", hit);
        }
        return hits;
    }

    private Map<String, List<Double>> embedSectionsByKey(Map<String, String> sections) {
        List<String> keys = new ArrayList<>(sections.keySet());
        List<String> texts = new ArrayList<>();
        for (String key : keys) {
            texts.add(sections.get(key));
        }
        List<List<Double>> vectors = embeddingAdapter.embedTexts(texts);
        Map<String, List<Double>> map = new LinkedHashMap<>();
        for (int i = 0; i < keys.size() && i < vectors.size(); i++) {
            List<Double> vec = vectors.get(i);
            if (vec != null && !vec.isEmpty()) {
                map.put(keys.get(i), vec);
            }
        }
        return map;
    }

    private record QueryContext(String embedInput, PatientPrescriptionSimilarityDetailsResponse details) {
    }

    private record HitEmbedSlot(int hitIndex, String section) {
    }

    private static int sectionOrderIndex(String section) {
        return switch (Objects.toString(section, "")) {
            case PatientPrescriptionSectionSimilarity.SECTION_DIAGNOSIS -> 0;
            case PatientPrescriptionSectionSimilarity.SECTION_MEDICINES -> 1;
            case PatientPrescriptionSectionSimilarity.SECTION_DOSAGE -> 2;
            case PatientPrescriptionSectionSimilarity.SECTION_ADVICE -> 3;
            case PatientPrescriptionSectionSimilarity.SECTION_NOTES -> 4;
            default -> 99;
        };
    }

    private PatientPrescriptionSimilarityHitResponse mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        UUID externalId = (UUID) rs.getObject("external_id");
        double matchPercent = rs.getDouble("match_percent");
        if (rs.wasNull()) {
            matchPercent = 0.0;
        }
        Timestamp created = rs.getTimestamp("created_at");
        Instant createdAt = created == null ? null : created.toInstant();
        String searchText = Objects.toString(rs.getString("search_text"), "").trim();
        String extractedJson = Objects.toString(rs.getString("extracted_data"), "").trim();
        PatientPrescriptionSimilarityDetailsResponse details =
                PatientPrescriptionExtractedJsonReader.read(objectMapper, extractedJson);
        if (isDetailsEmpty(details) && !searchText.isBlank()) {
            details = fallbackDetailsFromSearchText(searchText);
        }
        return new PatientPrescriptionSimilarityHitResponse(
                externalId,
                matchPercent,
                Objects.toString(rs.getString("status"), "").trim(),
                Objects.toString(rs.getString("patient_name"), "").trim(),
                Objects.toString(rs.getString("doctor_name"), "").trim(),
                Objects.toString(rs.getString("department"), "").trim(),
                Objects.toString(rs.getString("patient_gender"), "").trim(),
                searchText,
                details,
                List.of(),
                createdAt
        );
    }

    private QueryContext resolveQueryContext(String actorUserId, MultipartFile file, String queryText) {
        if (file != null && !file.isEmpty()) {
            EducationPrescriptionTranscribeData extracted = transcriptionService.transcribe(actorUserId, file);
            String clinical = extracted.toSearchText();
            PatientPrescriptionSimilarityDetailsResponse details =
                    PatientPrescriptionSectionSimilarity.fromTranscribe(extracted);
            if (!clinical.isBlank()) {
                return new QueryContext(clinical, details);
            }
            String diagnosis = Objects.toString(extracted.diagnosis(), "").trim();
            String medications = Objects.toString(extracted.medications(), "").trim();
            String fallback = ("Diagnosis: " + diagnosis + "\nMedications: " + medications).trim();
            return new QueryContext(normalizeFreeText(fallback), details);
        }
        String normalized = normalizeFreeText(queryText);
        return new QueryContext(normalized, PatientPrescriptionSectionSimilarity.parseQueryText(queryText));
    }

    private static boolean isDetailsEmpty(PatientPrescriptionSimilarityDetailsResponse details) {
        if (details == null) {
            return true;
        }
        return details.diagnosis().isBlank()
                && details.medicines().isEmpty()
                && details.dosage().isEmpty()
                && details.advice().isEmpty()
                && details.notes().isBlank();
    }

    private static PatientPrescriptionSimilarityDetailsResponse fallbackDetailsFromSearchText(String searchText) {
        return new PatientPrescriptionSimilarityDetailsResponse(
                searchText,
                List.of(),
                List.of(),
                List.of(),
                ""
        );
    }

    private static String visibilityClause(UserRole role) {
        if (role == UserRole.ADMIN || role == UserRole.DOCTOR) {
            return "";
        }
        return " AND p.patient_user_id = ? ";
    }

    private static Object[] buildParams(String actorUserId, UserRole role, String vectorLiteral, int resultLimit) {
        List<Object> params = new ArrayList<>();
        params.add(vectorLiteral);
        if (role != UserRole.ADMIN && role != UserRole.DOCTOR) {
            params.add(actorUserId);
        }
        params.add(vectorLiteral);
        params.add(resultLimit);
        return params.toArray();
    }

    private void logEmptySearchDiagnostics(String actorUserId, UserRole role) {
        try {
            String scopeSql = """
                    SELECT
                        COUNT(*) FILTER (WHERE p.embedding IS NOT NULL) AS with_embedding,
                        COUNT(*) FILTER (WHERE p.embedding IS NULL) AS without_embedding,
                        COUNT(*) AS total
                    FROM patient_prescriptions p
                    WHERE p.deleted = false
                    """ + visibilityClause(role);
            Object[] scopeParams = scopeParamsOnly(actorUserId, role);
            jdbcTemplate.query(
                    scopeSql,
                    rs -> {
                        if (rs.next()) {
                            LOG.info(
                                    "patient_prescription_similarity_empty actorId={} role={} visibleTotal={} "
                                            + "withEmbedding={} withoutEmbedding={}",
                                    actorUserId,
                                    role,
                                    rs.getLong("total"),
                                    rs.getLong("with_embedding"),
                                    rs.getLong("without_embedding")
                            );
                        }
                        return null;
                    },
                    scopeParams
            );
        } catch (Exception ex) {
            LOG.debug(
                    "patient_prescription_similarity_empty_diag_failed actorId={} type={}",
                    actorUserId,
                    ex.getClass().getSimpleName()
            );
        }
    }

    private static Object[] scopeParamsOnly(String actorUserId, UserRole role) {
        if (role == UserRole.ADMIN || role == UserRole.DOCTOR) {
            return new Object[]{};
        }
        return new Object[]{actorUserId};
    }

    private UserRole resolveRole(String userId) {
        return userRepository.findById(userId)
                .map(UserJpaEntity::getRole)
                .orElse(UserRole.PATIENT);
    }

    private static String normalizeFreeText(String raw) {
        String text = Objects.toString(raw, "").trim();
        if (text.isBlank()) {
            return "";
        }
        text = text.replaceAll("\\s+", " ").trim();
        if (text.length() > MAX_QUERY_CHARS) {
            return text.substring(0, MAX_QUERY_CHARS);
        }
        return text;
    }
}
