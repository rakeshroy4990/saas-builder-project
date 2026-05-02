package com.flexshell.prescription;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.security.PatientDataEncryptionService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Maps structured prescription entities to encrypted Mongo fields when a data key is configured.
 */
@Component
public class StructuredPrescriptionCrypto {

    private final PatientDataEncryptionService encryption;
    private final ObjectMapper objectMapper;

    public StructuredPrescriptionCrypto(PatientDataEncryptionService encryption, ObjectMapper objectMapper) {
        this.encryption = encryption;
        this.objectMapper = objectMapper;
    }

    /** Restore plaintext maps and PDF from ciphertext after load from Mongo. */
    public void normalizeAfterLoad(StructuredPrescriptionEntity e) {
        if (!encryption.isEnabled() || e == null) {
            return;
        }
        try {
            byte[] dCipher = e.getDraftPayloadCipher();
            if (dCipher != null && dCipher.length > 0 && PatientDataEncryptionService.looksEncrypted(dCipher)) {
                byte[] json = encryption.decrypt(dCipher);
                Map<String, Object> map = objectMapper.readValue(json, new TypeReference<>() {});
                e.setDraftPayload(map != null ? map : new LinkedHashMap<>());
            }
            byte[] sCipher = e.getSignedPayloadCipher();
            if (sCipher != null && sCipher.length > 0 && PatientDataEncryptionService.looksEncrypted(sCipher)) {
                byte[] json = encryption.decrypt(sCipher);
                Map<String, Object> map = objectMapper.readValue(json, new TypeReference<>() {});
                e.setSignedPayload(map != null ? map : new LinkedHashMap<>());
            }
            byte[] pCipher = e.getPdfBytesCipher();
            if (pCipher != null && pCipher.length > 0 && PatientDataEncryptionService.looksEncrypted(pCipher)) {
                e.setPdfBytes(encryption.decrypt(pCipher));
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to decrypt prescription fields", ex);
        }
    }

    /** Replace plaintext PHI in the entity with ciphertext fields before {@code save}. */
    public void prepareForStore(StructuredPrescriptionEntity e) {
        if (!encryption.isEnabled() || e == null) {
            return;
        }
        try {
            if (e.getDraftPayload() != null && !e.getDraftPayload().isEmpty()) {
                byte[] json = objectMapper.writeValueAsBytes(e.getDraftPayload());
                e.setDraftPayloadCipher(encryption.encrypt(json));
                e.setDraftPayload(new LinkedHashMap<>());
            }
            if (e.getSignedPayload() != null && !e.getSignedPayload().isEmpty()) {
                byte[] json = objectMapper.writeValueAsBytes(e.getSignedPayload());
                e.setSignedPayloadCipher(encryption.encrypt(json));
                e.setSignedPayload(new LinkedHashMap<>());
            }
            if (e.getPdfBytes() != null && e.getPdfBytes().length > 0) {
                e.setPdfBytesCipher(encryption.encrypt(e.getPdfBytes()));
                e.setPdfBytes(null);
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to encrypt prescription fields", ex);
        }
    }
}
