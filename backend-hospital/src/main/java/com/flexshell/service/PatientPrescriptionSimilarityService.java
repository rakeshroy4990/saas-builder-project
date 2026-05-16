package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiEmbeddingAdapter;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityDetailsResponse;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityHitResponse;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import com.flexshell.prescription.PatientPrescriptionExtractedJsonReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
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
        String embedInput = resolveEmbedInput(actorUserId, file, queryText);
        if (embedInput.isBlank()) {
            throw new IllegalArgumentException("Enter search text or upload a prescription file.");
        }
        if (!embeddingAdapter.isConfigured()) {
            throw new IllegalStateException("OpenAI embedding is not configured.");
        }
        List<Double> vector = embeddingAdapter.embedText(embedInput);
        if (vector.isEmpty()) {
            throw new IllegalStateException("Could not build query embedding.");
        }
        String vectorLiteral = OpenAiEmbeddingAdapter.toPgVectorLiteral(vector);
        if (vectorLiteral == null) {
            throw new IllegalStateException("Could not build query embedding.");
        }

        int resultLimit = Math.min(MAX_LIMIT, Math.max(1, limit <= 0 ? DEFAULT_LIMIT : limit));
        UserRole role = resolveRole(actorUserId);
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

        if (hits.isEmpty()) {
            logEmptySearchDiagnostics(actorUserId, role);
        } else {
            LOG.debug(
                    "patient_prescription_similarity_ok actorId={} role={} queryLen={} hitCount={} topMatch={}",
                    actorUserId,
                    role,
                    embedInput.length(),
                    hits.size(),
                    hits.get(0).matchPercent()
            );
        }
        return hits;
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
                createdAt
        );
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

    /** When JSONB is empty, expose search_text as diagnosis for display. */
    private static PatientPrescriptionSimilarityDetailsResponse fallbackDetailsFromSearchText(String searchText) {
        return new PatientPrescriptionSimilarityDetailsResponse(
                searchText,
                List.of(),
                List.of(),
                List.of(),
                ""
        );
    }

    /**
     * Doctors and admins search the full corpus; other roles (if ever allowed) are scoped to own uploads.
     */
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

    private String resolveEmbedInput(String actorUserId, MultipartFile file, String queryText) {
        if (file != null && !file.isEmpty()) {
            EducationPrescriptionTranscribeData extracted = transcriptionService.transcribe(actorUserId, file);
            String clinical = extracted.toSearchText();
            if (!clinical.isBlank()) {
                return clinical;
            }
            String diagnosis = Objects.toString(extracted.diagnosis(), "").trim();
            String medications = Objects.toString(extracted.medications(), "").trim();
            String fallback = ("Diagnosis: " + diagnosis + "\nMedications: " + medications).trim();
            return normalizeFreeText(fallback);
        }
        return normalizeFreeText(queryText);
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
