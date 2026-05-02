package com.flexshell.prescription;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.StructuredPrescriptionResponse;
import com.flexshell.service.AppointmentService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class StructuredPrescriptionService {

    private static final String AUDIT_CREATE = "CREATE_DRAFT";
    private static final String AUDIT_UPDATE = "UPDATE_DRAFT";
    private static final String AUDIT_VALIDATE = "VALIDATE";
    private static final String AUDIT_FINALIZE = "FINALIZE";

    private final StructuredPrescriptionRepository prescriptionRepository;
    private final AppointmentService appointmentService;
    private final ObjectProvider<UserRepository> userRepositoryProvider;
    private final ObjectMapper objectMapper;
    private final ClinicPrescriptionPdfRenderer pdfRenderer;
    private final PrescriptionSignaturePort signaturePort;
    private final StructuredPrescriptionCrypto structuredPrescriptionCrypto;

    public StructuredPrescriptionService(
            StructuredPrescriptionRepository prescriptionRepository,
            AppointmentService appointmentService,
            ObjectProvider<UserRepository> userRepositoryProvider,
            ObjectMapper objectMapper,
            ClinicPrescriptionPdfRenderer pdfRenderer,
            PrescriptionSignaturePort signaturePort,
            StructuredPrescriptionCrypto structuredPrescriptionCrypto
    ) {
        this.prescriptionRepository = prescriptionRepository;
        this.appointmentService = appointmentService;
        this.userRepositoryProvider = userRepositoryProvider;
        this.objectMapper = objectMapper;
        this.pdfRenderer = pdfRenderer;
        this.signaturePort = signaturePort;
        this.structuredPrescriptionCrypto = structuredPrescriptionCrypto;
    }

    public StructuredPrescriptionResponse getOrCreateDraft(String appointmentId, String actorUserId) {
        AppointmentEntity appt = appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
        assertAssignedDoctor(appt, actorUserId);
        assertAppointmentCompletedForPrescribing(appt);
        Optional<StructuredPrescriptionEntity> existing = prescriptionRepository.findByAppointmentId(appointmentId);
        if (existing.isPresent()) {
            StructuredPrescriptionEntity e = existing.get();
            structuredPrescriptionCrypto.normalizeAfterLoad(e);
            if (StructuredPrescriptionEntity.STATUS_DRAFT.equalsIgnoreCase(e.getStatus())) {
                assertCanViewPrescriptionDraft(actorUserId, appt, e);
            }
            return toResponse(e, null);
        }
        UserEntity doctor = loadUser(appt.getDoctorId());
        StructuredPrescriptionEntity e = new StructuredPrescriptionEntity();
        e.setAppointmentId(appointmentId);
        e.setPrescriberUserId(normalize(appt.getDoctorId()));
        e.setStatus(StructuredPrescriptionEntity.STATUS_DRAFT);
        e.setTemplateVersion(ClinicTelemedicinePrescriptionSchema.TEMPLATE_VERSION);
        e.setDraftPayload(seedPayload(appt, doctor));
        Instant now = Instant.now();
        e.setCreatedAt(now);
        e.setUpdatedAt(now);
        appendAudit(e, actorUserId, AUDIT_CREATE, "draft created");
        return toResponse(savePrescription(e), null);
    }

    public StructuredPrescriptionResponse saveDraft(String appointmentId, Map<String, Object> body, String actorUserId) {
        AppointmentEntity appt = appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
        StructuredPrescriptionEntity e = requireDraftEntity(appointmentId);
        assertAssignedDoctor(appt, actorUserId);
        assertAppointmentCompletedForPrescribing(appt);
        Map<String, Object> merged = mergePayload(e.getDraftPayload(), body);
        merged.put(ClinicTelemedicinePrescriptionSchema.KEY_TEMPLATE_VERSION, ClinicTelemedicinePrescriptionSchema.TEMPLATE_VERSION);
        e.setDraftPayload(merged);
        e.setUpdatedAt(Instant.now());
        appendAudit(e, actorUserId, AUDIT_UPDATE, "draft saved");
        return toResponse(savePrescription(e), null);
    }

    public StructuredPrescriptionResponse validate(String appointmentId, String actorUserId) {
        AppointmentEntity appt = appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
        StructuredPrescriptionEntity e = requireExisting(appointmentId);
        assertAssignedDoctor(appt, actorUserId);
        assertAppointmentCompletedForPrescribing(appt);
        if (StructuredPrescriptionEntity.STATUS_SIGNED.equalsIgnoreCase(e.getStatus())) {
            throw new IllegalArgumentException("Signed prescriptions cannot be re-validated as drafts");
        }
        List<String> errors = StructuredPrescriptionValidator.validate(e.getDraftPayload());
        appendAudit(e, actorUserId, AUDIT_VALIDATE, errors.isEmpty() ? "ok" : String.join("; ", errors));
        StructuredPrescriptionEntity saved = savePrescription(e);
        return toResponse(saved, errors);
    }

    public StructuredPrescriptionResponse finalize(String appointmentId, String actorUserId, String remoteIp) {
        AppointmentEntity appt = appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
        StructuredPrescriptionEntity e = requireDraftEntity(appointmentId);
        assertAssignedDoctor(appt, actorUserId);
        assertAppointmentCompletedForPrescribing(appt);
        List<String> errors = StructuredPrescriptionValidator.validate(e.getDraftPayload());
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Validation failed: " + String.join("; ", errors));
        }
        Map<String, Object> signed = deepCopy(e.getDraftPayload());
        byte[] pdf = pdfRenderer.render(signed);
        String hash = PrescriptionCrypto.sha256Hex(pdf);
        Map<String, String> auditCtx = new LinkedHashMap<>();
        auditCtx.put("remoteIp", remoteIp == null ? "" : remoteIp);
        SignatureResult sig = signaturePort.signPdfSha256(hash, actorUserId, auditCtx);
        e.setSignedPayload(signed);
        e.setPdfBytes(pdf);
        e.setPdfSha256(hash);
        e.setSignatureVendor(sig.vendor());
        e.setSignatureAttestationId(sig.attestationId());
        e.setSignatureMetadata(sig.metadata() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(sig.metadata()));
        e.setSignedAt(Instant.now());
        e.setStatus(StructuredPrescriptionEntity.STATUS_SIGNED);
        e.setUpdatedAt(Instant.now());
        appendAudit(e, actorUserId, AUDIT_FINALIZE, "finalized vendor=" + sig.vendor() + " attestation=" + sig.attestationId());
        return toResponse(savePrescription(e), null);
    }

    public StructuredPrescriptionResponse get(String appointmentId, String actorUserId) {
        appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
        StructuredPrescriptionEntity e = requireExisting(appointmentId);
        if (StructuredPrescriptionEntity.STATUS_DRAFT.equalsIgnoreCase(e.getStatus())) {
            AppointmentEntity appt = appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
            assertCanViewPrescriptionDraft(actorUserId, appt, e);
        }
        return toResponse(e, null);
    }

    public byte[] getPdfBytes(String appointmentId, String actorUserId) {
        appointmentService.requireAppointmentEntity(appointmentId, actorUserId);
        StructuredPrescriptionEntity e = requireExisting(appointmentId);
        if (!StructuredPrescriptionEntity.STATUS_SIGNED.equalsIgnoreCase(e.getStatus())) {
            throw new IllegalArgumentException("Prescription PDF is available only after signing");
        }
        if (e.getPdfBytes() == null || e.getPdfBytes().length == 0) {
            throw new IllegalStateException("Signed PDF bytes are missing");
        }
        return e.getPdfBytes();
    }

    private void assertCanViewPrescriptionDraft(String actorUserId, AppointmentEntity appt, StructuredPrescriptionEntity e) {
        UserRole role = resolveUserRole(actorUserId);
        if (role == UserRole.ADMIN) {
            return;
        }
        if (role == UserRole.DOCTOR && normalize(appt.getDoctorId()).equalsIgnoreCase(normalize(actorUserId))) {
            return;
        }
        throw new SecurityException("Draft e-prescriptions are only visible to the treating doctor");
    }

    private StructuredPrescriptionEntity savePrescription(StructuredPrescriptionEntity e) {
        structuredPrescriptionCrypto.prepareForStore(e);
        StructuredPrescriptionEntity saved = prescriptionRepository.save(e);
        structuredPrescriptionCrypto.normalizeAfterLoad(saved);
        return saved;
    }

    private StructuredPrescriptionEntity requireExisting(String appointmentId) {
        StructuredPrescriptionEntity e = prescriptionRepository
                .findByAppointmentId(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("Structured prescription not found"));
        structuredPrescriptionCrypto.normalizeAfterLoad(e);
        return e;
    }

    private StructuredPrescriptionEntity requireDraftEntity(String appointmentId) {
        StructuredPrescriptionEntity e = requireExisting(appointmentId);
        if (!StructuredPrescriptionEntity.STATUS_DRAFT.equalsIgnoreCase(e.getStatus())) {
            throw new IllegalArgumentException("Prescription is already signed and cannot be edited");
        }
        return e;
    }

    private void assertAssignedDoctor(AppointmentEntity appt, String actorUserId) {
        UserRole role = resolveUserRole(actorUserId);
        if (role != UserRole.DOCTOR) {
            throw new SecurityException("Only the treating doctor can edit this e-prescription");
        }
        if (!normalize(appt.getDoctorId()).equalsIgnoreCase(normalize(actorUserId))) {
            throw new SecurityException("Only the assigned doctor can edit this e-prescription");
        }
    }

    private void assertAppointmentCompletedForPrescribing(AppointmentEntity apt) {
        if (!"COMPLETED".equalsIgnoreCase(normalize(apt.getStatus()))) {
            throw new IllegalArgumentException("Appointment must be marked completed before issuing a structured e-prescription");
        }
    }

    private UserEntity loadUser(String userId) {
        UserRepository repo = userRepositoryProvider.getIfAvailable();
        if (repo == null) {
            return null;
        }
        return repo.findById(normalize(userId)).orElse(null);
    }

    private UserRole resolveUserRole(String actorUserId) {
        UserRepository repo = userRepositoryProvider.getIfAvailable();
        if (repo == null) {
            throw new IllegalStateException("User repository is unavailable");
        }
        UserEntity user = repo.findById(normalize(actorUserId))
                .orElseThrow(() -> new SecurityException("User not found"));
        return user.getRole();
    }

    private Map<String, Object> seedPayload(AppointmentEntity appt, UserEntity doctor) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_TEMPLATE_VERSION, ClinicTelemedicinePrescriptionSchema.TEMPLATE_VERSION);
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_DATE_TIME, Instant.now().toString());
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_MODE, "VIDEO");
        Map<String, Object> clinic = new LinkedHashMap<>();
        clinic.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_NAME, "");
        clinic.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_ADDRESS, "");
        clinic.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_PHONE, "");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC, clinic);
        Map<String, Object> prescriber = new LinkedHashMap<>();
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_DISPLAY_NAME, displayName(doctor, appt.getDoctorName()));
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_QUALIFICATIONS, "");
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_NAME, "");
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_REGISTRATION, "");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER, prescriber);
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_NAME, normalize(appt.getPatientName()));
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_AGE_OR_DOB, normalize(appt.getAgeGroup()));
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_SEX, "");
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_ADDRESS, "");
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_PHONE, normalize(appt.getPhoneNumber()));
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT, patient);
        List<Map<String, Object>> meds = new ArrayList<>();
        meds.add(emptyMedicineLine());
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_MEDICINES, meds);
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_GENERAL_ADVICE, "");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_FOLLOW_UP_ADVICE, "");
        return payload;
    }

    private static Map<String, Object> emptyMedicineLine() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_STRENGTH, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_DOSE, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_FREQUENCY, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_ROUTE, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_DURATION_DAYS, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_INSTRUCTIONS, "");
        m.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_SCHEDULE_CATEGORY, "");
        return m;
    }

    private static String displayName(UserEntity doctor, String fallbackDoctorName) {
        if (doctor != null) {
            String first = normalize(doctor.getFirstName());
            String last = normalize(doctor.getLastName());
            String full = (first + " " + last).trim();
            if (!full.isBlank()) {
                return full;
            }
            if (!normalize(doctor.getUsername()).isBlank()) {
                return normalize(doctor.getUsername());
            }
        }
        return normalize(fallbackDoctorName);
    }

    private Map<String, Object> mergePayload(Map<String, Object> current, Map<String, Object> patch) {
        Map<String, Object> base = current == null ? new LinkedHashMap<>() : deepCopy(current);
        if (patch == null) {
            return base;
        }
        for (Map.Entry<String, Object> en : patch.entrySet()) {
            base.put(en.getKey(), en.getValue());
        }
        return base;
    }

    private Map<String, Object> deepCopy(Map<String, Object> src) {
        if (src == null) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(objectMapper.writeValueAsBytes(src), new TypeReference<>() {
            });
        } catch (IOException ex) {
            throw new IllegalArgumentException("Unable to copy prescription payload", ex);
        }
    }

    private void appendAudit(StructuredPrescriptionEntity e, String actorUserId, String action, String detail) {
        List<PrescriptionAuditEntry> log = e.getAuditLog();
        if (log == null) {
            log = new ArrayList<>();
            e.setAuditLog(log);
        }
        PrescriptionAuditEntry row = new PrescriptionAuditEntry();
        row.setAt(Instant.now());
        row.setUserId(normalize(actorUserId));
        row.setAction(action);
        row.setDetail(detail == null ? "" : detail);
        log.add(row);
    }

    private StructuredPrescriptionResponse toResponse(StructuredPrescriptionEntity e, List<String> validationErrors) {
        boolean draft = StructuredPrescriptionEntity.STATUS_DRAFT.equalsIgnoreCase(e.getStatus());
        Map<String, Object> payload = draft ? e.getDraftPayload() : e.getSignedPayload();
        if (payload == null || payload.isEmpty()) {
            payload = e.getDraftPayload();
        }
        String signedAt = e.getSignedAt() == null ? null : e.getSignedAt().toString();
        return new StructuredPrescriptionResponse(
                e.getAppointmentId(),
                e.getStatus(),
                e.getTemplateVersion(),
                payload == null ? Map.of() : payload,
                draft,
                signedAt,
                e.getPdfSha256(),
                e.getSignatureVendor(),
                e.getSignatureAttestationId(),
                e.getSignatureMetadata(),
                validationErrors == null ? List.of() : validationErrors
        );
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
