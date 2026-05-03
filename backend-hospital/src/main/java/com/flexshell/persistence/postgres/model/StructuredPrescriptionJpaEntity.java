package com.flexshell.persistence.postgres.model;

import com.flexshell.prescription.PrescriptionAuditEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "structured_prescriptions")
public class StructuredPrescriptionJpaEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "appointment_id", nullable = false, unique = true, length = 64)
    private String appointmentId;

    @Column(name = "prescriber_user_id", length = 64)
    private String prescriberUserId;

    @Column(nullable = false, length = 32)
    private String status = "DRAFT";

    @Column(name = "template_version")
    private String templateVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "draft_payload", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> draftPayload = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "signed_payload", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> signedPayload = new LinkedHashMap<>();

    @Lob
    @Column(name = "pdf_bytes")
    private byte[] pdfBytes;

    @Lob
    @Column(name = "pdf_bytes_cipher")
    private byte[] pdfBytesCipher;

    @Lob
    @Column(name = "draft_payload_cipher")
    private byte[] draftPayloadCipher;

    @Lob
    @Column(name = "signed_payload_cipher")
    private byte[] signedPayloadCipher;

    @Column(name = "pdf_sha256")
    private String pdfSha256;

    @Column(name = "signed_at")
    private Instant signedAt;

    @Column(name = "signature_vendor")
    private String signatureVendor;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "signature_metadata", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> signatureMetadata = new LinkedHashMap<>();

    @Column(name = "signature_attestation_id")
    private String signatureAttestationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "audit_log", nullable = false, columnDefinition = "jsonb")
    private List<PrescriptionAuditEntry> auditLog = new ArrayList<>();

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(nullable = false)
    private boolean deleted = false;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        if (draftPayload == null) {
            draftPayload = new LinkedHashMap<>();
        }
        if (signedPayload == null) {
            signedPayload = new LinkedHashMap<>();
        }
        if (signatureMetadata == null) {
            signatureMetadata = new LinkedHashMap<>();
        }
        if (auditLog == null) {
            auditLog = new ArrayList<>();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
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

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
