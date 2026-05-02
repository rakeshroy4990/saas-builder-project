package com.flexshell.prescription;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "structuredPrescription")
public class StructuredPrescriptionEntity {
    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_SIGNED = "SIGNED";

    @Id
    private String id;

    @Indexed(unique = true)
    @Field("AppointmentId")
    private String appointmentId;

    @Field("PrescriberUserId")
    private String prescriberUserId;

    @Field("Status")
    private String status = STATUS_DRAFT;

    @Field("TemplateVersion")
    private String templateVersion;

    @Field("DraftPayload")
    private Map<String, Object> draftPayload = new LinkedHashMap<>();

    @Field("SignedPayload")
    private Map<String, Object> signedPayload = new LinkedHashMap<>();

    @Field("PdfBytes")
    private byte[] pdfBytes;

    /** AES-GCM ciphertext when {@code app.patient-data.encryption.key} is set; plaintext {@link #pdfBytes} may be null in DB. */
    @Field("PdfBytesCipher")
    private byte[] pdfBytesCipher;

    @Field("DraftPayloadCipher")
    private byte[] draftPayloadCipher;

    @Field("SignedPayloadCipher")
    private byte[] signedPayloadCipher;

    @Field("PdfSha256")
    private String pdfSha256;

    @Field("SignedAt")
    private Instant signedAt;

    @Field("SignatureVendor")
    private String signatureVendor;

    @Field("SignatureMetadata")
    private Map<String, Object> signatureMetadata = new LinkedHashMap<>();

    @Field("SignatureAttestationId")
    private String signatureAttestationId;

    @Field("AuditLog")
    private List<PrescriptionAuditEntry> auditLog = new ArrayList<>();

    @Field("CreatedAt")
    private Instant createdAt;

    @Field("UpdatedAt")
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(String appointmentId) {
        this.appointmentId = appointmentId;
    }

    public String getPrescriberUserId() {
        return prescriberUserId;
    }

    public void setPrescriberUserId(String prescriberUserId) {
        this.prescriberUserId = prescriberUserId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTemplateVersion() {
        return templateVersion;
    }

    public void setTemplateVersion(String templateVersion) {
        this.templateVersion = templateVersion;
    }

    public Map<String, Object> getDraftPayload() {
        return draftPayload;
    }

    public void setDraftPayload(Map<String, Object> draftPayload) {
        this.draftPayload = draftPayload;
    }

    public Map<String, Object> getSignedPayload() {
        return signedPayload;
    }

    public void setSignedPayload(Map<String, Object> signedPayload) {
        this.signedPayload = signedPayload;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }

    public void setPdfBytes(byte[] pdfBytes) {
        this.pdfBytes = pdfBytes;
    }

    public byte[] getPdfBytesCipher() {
        return pdfBytesCipher;
    }

    public void setPdfBytesCipher(byte[] pdfBytesCipher) {
        this.pdfBytesCipher = pdfBytesCipher;
    }

    public byte[] getDraftPayloadCipher() {
        return draftPayloadCipher;
    }

    public void setDraftPayloadCipher(byte[] draftPayloadCipher) {
        this.draftPayloadCipher = draftPayloadCipher;
    }

    public byte[] getSignedPayloadCipher() {
        return signedPayloadCipher;
    }

    public void setSignedPayloadCipher(byte[] signedPayloadCipher) {
        this.signedPayloadCipher = signedPayloadCipher;
    }

    public String getPdfSha256() {
        return pdfSha256;
    }

    public void setPdfSha256(String pdfSha256) {
        this.pdfSha256 = pdfSha256;
    }

    public Instant getSignedAt() {
        return signedAt;
    }

    public void setSignedAt(Instant signedAt) {
        this.signedAt = signedAt;
    }

    public String getSignatureVendor() {
        return signatureVendor;
    }

    public void setSignatureVendor(String signatureVendor) {
        this.signatureVendor = signatureVendor;
    }

    public Map<String, Object> getSignatureMetadata() {
        return signatureMetadata;
    }

    public void setSignatureMetadata(Map<String, Object> signatureMetadata) {
        this.signatureMetadata = signatureMetadata;
    }

    public String getSignatureAttestationId() {
        return signatureAttestationId;
    }

    public void setSignatureAttestationId(String signatureAttestationId) {
        this.signatureAttestationId = signatureAttestationId;
    }

    public List<PrescriptionAuditEntry> getAuditLog() {
        return auditLog;
    }

    public void setAuditLog(List<PrescriptionAuditEntry> auditLog) {
        this.auditLog = auditLog;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
