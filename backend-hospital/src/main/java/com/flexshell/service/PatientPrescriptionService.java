package com.flexshell.service;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.PatientPrescriptionDownloadResponse;
import com.flexshell.controller.dto.PatientPrescriptionGroupCreateRequest;
import com.flexshell.controller.dto.PatientPrescriptionGroupCreateResponse;
import com.flexshell.controller.dto.PatientPrescriptionSummaryResponse;
import com.flexshell.controller.dto.PatientPrescriptionUploadResponse;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.model.PatientPrescriptionGroupItemJpaEntity;
import com.flexshell.persistence.postgres.model.PatientPrescriptionGroupJpaEntity;
import com.flexshell.persistence.postgres.model.PatientPrescriptionJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionGroupItemJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionGroupJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientPrescriptionJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import com.flexshell.storage.PrescriptionFileStorage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PatientPrescriptionService {

    private static final Logger LOG = LoggerFactory.getLogger(PatientPrescriptionService.class);
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    private final PatientPrescriptionJpaRepository prescriptionRepository;
    private final PatientPrescriptionGroupJpaRepository groupRepository;
    private final PatientPrescriptionGroupItemJpaRepository groupItemRepository;
    private final AppointmentJpaRepository appointmentRepository;
    private final UserJpaRepository userRepository;
    private final PrescriptionFileStorage storageService;
    private final PatientPrescriptionExtractionWorker extractionWorker;
    private final int signedUrlTtlSeconds;

    public PatientPrescriptionService(
            PatientPrescriptionJpaRepository prescriptionRepository,
            PatientPrescriptionGroupJpaRepository groupRepository,
            PatientPrescriptionGroupItemJpaRepository groupItemRepository,
            AppointmentJpaRepository appointmentRepository,
            UserJpaRepository userRepository,
            PrescriptionFileStorage storageService,
            PatientPrescriptionExtractionWorker extractionWorker,
            @Value("${app.prescription.storage.signed-url-ttl-seconds:900}") int signedUrlTtlSeconds
    ) {
        this.prescriptionRepository = prescriptionRepository;
        this.groupRepository = groupRepository;
        this.groupItemRepository = groupItemRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.extractionWorker = extractionWorker;
        this.signedUrlTtlSeconds = Math.max(60, Math.min(3600, signedUrlTtlSeconds));
        LOG.info(
                "patient_prescription_service_ready storageClass={} storageEnabled={}",
                storageService.getClass().getSimpleName(),
                storageService.isEnabled()
        );
    }

    @Transactional
    public PatientPrescriptionUploadResponse upload(
            String actorUserId,
            MultipartFile file,
            UUID groupExternalId,
            Integer pageNumber,
            UUID appointmentExternalId
    ) {
        String originalName = file == null ? "" : Objects.toString(file.getOriginalFilename(), "").trim();
        LOG.info(
                "patient_prescription_upload_start storageClass={} storageEnabled={} originalFilename={} "
                        + "declaredSize={} groupExternalId={} pageNumber={}",
                storageService.getClass().getSimpleName(),
                storageService.isEnabled(),
                originalName.isBlank() ? "(none)" : originalName,
                file == null ? -1 : file.getSize(),
                groupExternalId,
                pageNumber
        );
        validateFile(file);
        byte[] bytes = readBytes(file);
        String mimeType = normalizeMime(file, bytes);
        String fileHash = computeFileHash(bytes);
        LOG.debug(
                "patient_prescription_upload_parsed bytes={} mimeType={} fileHashPrefix={}",
                bytes.length,
                mimeType,
                fileHash.length() > 16 ? fileHash.substring(0, 16) + "…" : fileHash
        );

        Optional<PatientPrescriptionJpaEntity> existing = prescriptionRepository.findByFileHashAndDeletedFalse(fileHash);
        if (existing.isPresent()) {
            PatientPrescriptionJpaEntity row = existing.get();
            assertCanRead(actorUserId, row);
            LOG.info(
                    "patient_prescription_upload_duplicate externalId={} status={}",
                    row.getExternalId(),
                    row.getStatus()
            );
            return new PatientPrescriptionUploadResponse(row.getExternalId(), true, row.getStatus());
        }

        String patientUserId = actorUserId;
        ResolvedAppointment resolvedAppointment = resolveAppointment(appointmentExternalId, actorUserId);

        String fileUuid = UUID.randomUUID().toString();
        String extension = extensionForMime(mimeType);
        String storagePath = "prescriptions/" + patientUserId + "/" + fileUuid + "." + extension;
        LOG.info(
                "patient_prescription_upload_storage_begin storageClass={} storageEnabled={} storagePath={} bytes={}",
                storageService.getClass().getSimpleName(),
                storageService.isEnabled(),
                storagePath,
                bytes.length
        );
        try {
            storageService.upload(storagePath, bytes, mimeType);
        } catch (RuntimeException ex) {
            LOG.error(
                    "patient_prescription_upload_storage_failed storageClass={} storagePath={} errorType={} message={}",
                    storageService.getClass().getSimpleName(),
                    storagePath,
                    ex.getClass().getSimpleName(),
                    ex.getMessage(),
                    ex
            );
            throw ex;
        }
        LOG.info("patient_prescription_upload_storage_ok storagePath={}", storagePath);

        PatientPrescriptionJpaEntity entity = new PatientPrescriptionJpaEntity();
        entity.setPatientUserId(patientUserId);
        entity.setUploadedBy(actorUserId);
        entity.setAppointmentId(resolvedAppointment.appointmentId());
        String doctorId = resolvedAppointment.doctorId();
        if (doctorId == null && resolveRole(actorUserId) == UserRole.DOCTOR) {
            doctorId = actorUserId;
        }
        entity.setDoctorId(doctorId);
        entity.setFileStoragePath(storagePath);
        entity.setFileHash(fileHash);
        entity.setFileSizeBytes(bytes.length);
        entity.setMimeType(mimeType);
        entity.setStatus("processing");
        entity.setExtractedData(new LinkedHashMap<>());
        PatientPrescriptionJpaEntity saved = prescriptionRepository.save(entity);

        linkToGroupIfPresent(saved, groupExternalId, pageNumber, patientUserId);

        extractionWorker.extractAsync(saved.getId(), bytes, mimeType, file.getOriginalFilename());

        LOG.info(
                "patient_prescription_upload_complete externalId={} prescriptionId={} status=processing",
                saved.getExternalId(),
                saved.getId()
        );
        return new PatientPrescriptionUploadResponse(saved.getExternalId(), false, "processing");
    }

    @Transactional(readOnly = true)
    public Page<PatientPrescriptionSummaryResponse> listForActor(String actorUserId, Pageable pageable) {
        UserRole role = resolveRole(actorUserId);
        Page<PatientPrescriptionJpaEntity> page;
        if (role == UserRole.ADMIN) {
            page = prescriptionRepository.findByDeletedFalse(pageable);
        } else if (role == UserRole.DOCTOR) {
            page = prescriptionRepository.findVisibleToDoctor(actorUserId, unsortedPageable(pageable));
        } else {
            page = prescriptionRepository.findByPatientUserIdAndDeletedFalse(actorUserId, pageable);
        }
        return page.map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public PatientPrescriptionSummaryResponse getMetadata(String actorUserId, UUID externalId) {
        PatientPrescriptionJpaEntity row = requireRow(externalId);
        assertCanRead(actorUserId, row);
        return toSummary(row);
    }

    @Transactional(readOnly = true)
    public PatientPrescriptionDownloadResponse downloadUrl(String actorUserId, UUID externalId) {
        PatientPrescriptionJpaEntity row = requireRow(externalId);
        assertCanRead(actorUserId, row);
        String signedUrl = storageService.createSignedUrl(row.getFileStoragePath());
        return new PatientPrescriptionDownloadResponse(signedUrl, signedUrlTtlSeconds);
    }

    @Transactional
    public PatientPrescriptionGroupCreateResponse createGroup(String actorUserId, PatientPrescriptionGroupCreateRequest request) {
        PatientPrescriptionGroupJpaEntity group = new PatientPrescriptionGroupJpaEntity();
        group.setPatientUserId(actorUserId);
        group.setLabel(Objects.toString(request.label(), "").trim());
        String groupType = Objects.toString(request.groupType(), "").trim().toLowerCase(Locale.ROOT);
        if (!groupType.isBlank()) {
            group.setGroupType(groupType);
        }
        PatientPrescriptionGroupJpaEntity saved = groupRepository.save(group);
        return new PatientPrescriptionGroupCreateResponse(saved.getExternalId());
    }

    @Transactional(readOnly = true)
    public List<PatientPrescriptionSummaryResponse> listGroupItems(String actorUserId, UUID groupExternalId) {
        PatientPrescriptionGroupJpaEntity group = groupRepository.findByExternalIdAndDeletedFalse(groupExternalId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (!actorUserId.equals(group.getPatientUserId()) && resolveRole(actorUserId) != UserRole.ADMIN) {
            throw new SecurityException("Forbidden");
        }
        List<PatientPrescriptionGroupItemJpaEntity> items = groupItemRepository.findByGroupIdOrderByPageNumberAsc(group.getId());
        List<PatientPrescriptionSummaryResponse> summaries = new ArrayList<>();
        for (PatientPrescriptionGroupItemJpaEntity item : items) {
            prescriptionRepository.findById(item.getPrescriptionId()).ifPresent(row -> {
                if (!row.isDeleted()) {
                    summaries.add(toSummary(row));
                }
            });
        }
        return summaries;
    }

    private void linkToGroupIfPresent(
            PatientPrescriptionJpaEntity saved,
            UUID groupExternalId,
            Integer pageNumber,
            String patientUserId
    ) {
        if (groupExternalId == null) {
            return;
        }
        PatientPrescriptionGroupJpaEntity group = groupRepository.findByExternalIdAndDeletedFalse(groupExternalId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        if (!patientUserId.equals(group.getPatientUserId())) {
            throw new SecurityException("Forbidden");
        }
        int page = pageNumber == null || pageNumber < 1 ? 1 : pageNumber;
        PatientPrescriptionGroupItemJpaEntity item = new PatientPrescriptionGroupItemJpaEntity();
        item.setPrescriptionId(saved.getId());
        item.setGroupId(group.getId());
        item.setPageNumber(page);
        item.setPrimaryPage(page == 1);
        groupItemRepository.save(item);
    }

    private ResolvedAppointment resolveAppointment(UUID appointmentExternalId, String actorUserId) {
        if (appointmentExternalId == null) {
            return ResolvedAppointment.empty();
        }
        AppointmentJpaEntity appointment = appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        UserRole role = resolveRole(actorUserId);
        if (role != UserRole.ADMIN && !actorUserId.equals(appointment.getCreatedBy()) && !actorUserId.equals(appointment.getDoctorId())) {
            throw new SecurityException("Forbidden");
        }
        return new ResolvedAppointment(appointment.getId(), appointment.getDoctorId());
    }

    private record ResolvedAppointment(String appointmentId, String doctorId) {
        private static ResolvedAppointment empty() {
            return new ResolvedAppointment(null, null);
        }
    }

    private PatientPrescriptionJpaEntity requireRow(UUID externalId) {
        return prescriptionRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("Prescription not found"));
    }

    private void assertCanRead(String actorUserId, PatientPrescriptionJpaEntity row) {
        UserRole role = resolveRole(actorUserId);
        if (role == UserRole.ADMIN || role == UserRole.DOCTOR) {
            return;
        }
        if (actorUserId.equals(row.getPatientUserId()) || actorUserId.equals(row.getUploadedBy())) {
            return;
        }
        if (row.getDoctorId() != null && actorUserId.equals(row.getDoctorId())) {
            return;
        }
        if (row.getAppointmentId() != null && !row.getAppointmentId().isBlank()) {
            Optional<AppointmentJpaEntity> appointment = appointmentRepository.findById(row.getAppointmentId());
            if (appointment.isPresent() && actorUserId.equals(appointment.get().getDoctorId())) {
                return;
            }
        }
        throw new SecurityException("Forbidden");
    }

    private UserRole resolveRole(String userId) {
        return userRepository.findById(userId)
                .map(UserJpaEntity::getRole)
                .orElse(UserRole.PATIENT);
    }

    /** Native SQL orders by {@code created_at}; ignore JPA property sorts like {@code createdAt}. */
    private static Pageable unsortedPageable(Pageable pageable) {
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
    }

    private PatientPrescriptionSummaryResponse toSummary(PatientPrescriptionJpaEntity row) {
        Map<String, Object> extracted = row.getExtractedData() == null ? Map.of() : row.getExtractedData();
        return new PatientPrescriptionSummaryResponse(
                row.getExternalId(),
                row.getStatus(),
                row.getMimeType(),
                row.getFileSizeBytes(),
                row.getCreatedAt(),
                row.getDoctorName(),
                row.getDepartment(),
                row.getPatientName(),
                row.getPatientGender(),
                extracted
        );
    }

    private static void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A non-empty file is required.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("File is too large (max 20 MB).");
        }
    }

    private static byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception ex) {
            throw new IllegalArgumentException("Could not read uploaded file.");
        }
    }

    private static String computeFileHash(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return "sha256:" + HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    private static String normalizeMime(MultipartFile file, byte[] bytes) {
        String declared = Objects.toString(file.getContentType(), "").trim().toLowerCase(Locale.ROOT);
        if ("application/pdf".equals(declared)) {
            return "application/pdf";
        }
        if ("image/png".equals(declared)) {
            return "image/png";
        }
        if ("image/jpeg".equals(declared) || "image/jpg".equals(declared)) {
            return "image/jpeg";
        }
        if (bytes.length >= 4 && bytes[0] == '%' && bytes[1] == 'P') {
            return "application/pdf";
        }
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 'P'
                && bytes[2] == 'N'
                && bytes[3] == 'G') {
            return "image/png";
        }
        throw new IllegalArgumentException("Unsupported file type. Use JPEG, PNG, or PDF.");
    }

    private static String extensionForMime(String mimeType) {
        if ("application/pdf".equals(mimeType)) {
            return "pdf";
        }
        if ("image/png".equals(mimeType)) {
            return "png";
        }
        return "jpg";
    }
}
