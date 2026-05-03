package com.flexshell.persistence.postgres;

import com.flexshell.persistence.api.StructuredPrescriptionAccess;
import com.flexshell.persistence.postgres.model.StructuredPrescriptionJpaEntity;
import com.flexshell.persistence.postgres.repository.StructuredPrescriptionJpaRepository;
import com.flexshell.prescription.StructuredPrescriptionEntity;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresStructuredPrescriptionAccess implements StructuredPrescriptionAccess {

    private final StructuredPrescriptionJpaRepository jpaRepository;

    public PostgresStructuredPrescriptionAccess(StructuredPrescriptionJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<StructuredPrescriptionEntity> findByAppointmentId(String appointmentId) {
        return jpaRepository.findByAppointmentIdAndDeletedFalse(appointmentId).map(this::toDomain);
    }

    @Override
    public StructuredPrescriptionEntity save(StructuredPrescriptionEntity entity) {
        Optional<StructuredPrescriptionJpaEntity> byAppt =
                jpaRepository.findByAppointmentIdAndDeletedFalse(entity.getAppointmentId());
        Optional<StructuredPrescriptionJpaEntity> existing = byAppt;
        if (existing.isEmpty() && entity.getId() != null && !entity.getId().isBlank()) {
            existing = jpaRepository.findById(entity.getId()).filter(e -> !e.isDeleted());
        }
        StructuredPrescriptionJpaEntity row = toJpa(entity, existing.orElse(null));
        StructuredPrescriptionJpaEntity saved = jpaRepository.save(row);
        return toDomain(saved);
    }

    private StructuredPrescriptionEntity toDomain(StructuredPrescriptionJpaEntity j) {
        StructuredPrescriptionEntity e = new StructuredPrescriptionEntity();
        e.setId(j.getId());
        e.setAppointmentId(j.getAppointmentId());
        e.setPrescriberUserId(j.getPrescriberUserId());
        e.setStatus(j.getStatus());
        e.setTemplateVersion(j.getTemplateVersion());
        e.setDraftPayload(j.getDraftPayload() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(j.getDraftPayload()));
        e.setSignedPayload(j.getSignedPayload() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(j.getSignedPayload()));
        e.setPdfBytes(j.getPdfBytes());
        e.setPdfBytesCipher(j.getPdfBytesCipher());
        e.setDraftPayloadCipher(j.getDraftPayloadCipher());
        e.setSignedPayloadCipher(j.getSignedPayloadCipher());
        e.setPdfSha256(j.getPdfSha256());
        e.setSignedAt(j.getSignedAt());
        e.setSignatureVendor(j.getSignatureVendor());
        e.setSignatureMetadata(
                j.getSignatureMetadata() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(j.getSignatureMetadata()));
        e.setSignatureAttestationId(j.getSignatureAttestationId());
        e.setAuditLog(j.getAuditLog() == null ? new java.util.ArrayList<>() : new java.util.ArrayList<>(j.getAuditLog()));
        e.setCreatedAt(j.getCreatedAt());
        e.setUpdatedAt(j.getUpdatedAt());
        return e;
    }

    private StructuredPrescriptionJpaEntity toJpa(StructuredPrescriptionEntity d, StructuredPrescriptionJpaEntity existing) {
        StructuredPrescriptionJpaEntity row = existing != null ? existing : new StructuredPrescriptionJpaEntity();
        if (existing == null) {
            if (d.getId() != null && !d.getId().isBlank()) {
                row.setId(d.getId());
            } else {
                row.setId(new ObjectId().toHexString());
            }
        }
        row.setAppointmentId(d.getAppointmentId());
        row.setPrescriberUserId(d.getPrescriberUserId());
        row.setStatus(d.getStatus());
        row.setTemplateVersion(d.getTemplateVersion());
        row.setDraftPayload(d.getDraftPayload() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(d.getDraftPayload()));
        row.setSignedPayload(d.getSignedPayload() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(d.getSignedPayload()));
        row.setPdfBytes(d.getPdfBytes());
        row.setPdfBytesCipher(d.getPdfBytesCipher());
        row.setDraftPayloadCipher(d.getDraftPayloadCipher());
        row.setSignedPayloadCipher(d.getSignedPayloadCipher());
        row.setPdfSha256(d.getPdfSha256());
        row.setSignedAt(d.getSignedAt());
        row.setSignatureVendor(d.getSignatureVendor());
        row.setSignatureMetadata(
                d.getSignatureMetadata() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(d.getSignatureMetadata()));
        row.setSignatureAttestationId(d.getSignatureAttestationId());
        row.setAuditLog(d.getAuditLog() == null ? new java.util.ArrayList<>() : new java.util.ArrayList<>(d.getAuditLog()));
        row.setCreatedAt(d.getCreatedAt());
        row.setUpdatedAt(d.getUpdatedAt());
        row.setDeleted(false);
        return row;
    }
}
