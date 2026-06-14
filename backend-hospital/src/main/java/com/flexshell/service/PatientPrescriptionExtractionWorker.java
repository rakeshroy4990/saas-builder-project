package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiEmbeddingAdapter;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.prescription.PatientPrescriptionExtractedColumns;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class PatientPrescriptionExtractionWorker {

    private static final Logger LOG = LoggerFactory.getLogger(PatientPrescriptionExtractionWorker.class);

    private final PatientPrescriptionJpaRepository prescriptionRepository;
    private final EducationPrescriptionTranscriptionService transcriptionService;
    private final OpenAiEmbeddingAdapter embeddingAdapter;
    private final ObjectMapper objectMapper;
    private final PrescriptionValidationService prescriptionValidationService;

    public PatientPrescriptionExtractionWorker(
            PatientPrescriptionJpaRepository prescriptionRepository,
            EducationPrescriptionTranscriptionService transcriptionService,
            OpenAiEmbeddingAdapter embeddingAdapter,
            ObjectMapper objectMapper,
            PrescriptionValidationService prescriptionValidationService
    ) {
        this.prescriptionRepository = prescriptionRepository;
        this.transcriptionService = transcriptionService;
        this.embeddingAdapter = embeddingAdapter;
        this.objectMapper = objectMapper;
        this.prescriptionValidationService = prescriptionValidationService;
    }

    @Async("patientPrescriptionExecutor")
    @Transactional
    public void extractAsync(String prescriptionId, byte[] bytes, String mimeType, String originalFilename) {
        try {
            String filename = Objects.toString(originalFilename, "prescription").trim();
            if (filename.isBlank()) {
                filename = "prescription";
            }
            BytesMultipartFile multipart = new BytesMultipartFile("file", filename, mimeType, bytes);
            EducationPrescriptionTranscribeData extracted = transcriptionService.transcribe("system", multipart);

            Map<String, Object> payload = extracted.toExtractedDataMap();
            String searchText = extracted.toSearchText();
            PatientPrescriptionExtractedColumns.Values columns = PatientPrescriptionExtractedColumns.from(extracted);

            String vectorLiteral = null;
            if (searchText.isBlank()) {
                LOG.warn("patient_prescription_search_text_empty prescriptionId={}", prescriptionId);
            } else if (!embeddingAdapter.isConfigured()) {
                LOG.warn(
                        "patient_prescription_embedding_skipped prescriptionId={} reason=openai_api_key_missing",
                        prescriptionId
                );
            } else {
                List<Double> vector = embeddingAdapter.embedText(searchText);
                vectorLiteral = OpenAiEmbeddingAdapter.toPgVectorLiteral(vector);
                if (vectorLiteral == null) {
                    LOG.warn(
                            "patient_prescription_embedding_failed prescriptionId={} searchTextLen={}",
                            prescriptionId,
                            searchText.length()
                    );
                }
            }

            String extractedJson = objectMapper.writeValueAsString(payload);
            String status = "verified";

            int updated = prescriptionRepository.updateExtractionNative(
                    prescriptionId,
                    vectorLiteral,
                    extractedJson,
                    searchText,
                    columns.doctorName(),
                    columns.department(),
                    columns.patientName(),
                    columns.patientGender(),
                    status
            );
            if (updated == 0) {
                prescriptionRepository.findById(prescriptionId).ifPresent(row -> {
                    row.setExtractedData(payload);
                    row.setSearchText(searchText);
                    row.setDoctorName(columns.doctorName());
                    row.setDepartment(columns.department());
                    row.setPatientName(columns.patientName());
                    row.setPatientGender(columns.patientGender());
                    row.setStatus(status);
                    prescriptionRepository.save(row);
                    prescriptionValidationService.validatePatientPrescriptionAsync(row.getExternalId());
                });
            } else {
                LOG.info(
                        "patient_prescription_extraction_ok prescriptionId={} searchTextLen={} hasEmbedding={}",
                        prescriptionId,
                        searchText.length(),
                        vectorLiteral != null
                );
                prescriptionRepository.findById(prescriptionId).ifPresent(row ->
                        prescriptionValidationService.validatePatientPrescriptionAsync(row.getExternalId())
                );
            }
        } catch (Exception ex) {
            LOG.warn("patient_prescription_extraction_failed prescriptionId={}", prescriptionId);
            prescriptionRepository.findById(prescriptionId).ifPresent(row -> {
                row.setStatus("rejected");
                prescriptionRepository.save(row);
            });
        }
    }
}
