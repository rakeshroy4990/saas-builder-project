package com.flexshell.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-256-GCM field-level encryption for sensitive patient payloads stored in MongoDB.
 * Set {@code APP_PATIENT_DATA_ENCRYPTION_KEY} to a Base64-encoded 32-byte key in production.
 * When unset, plaintext persistence is unchanged (development only).
 */
@Service
public class PatientDataEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(PatientDataEncryptionService.class);
    private static final byte[] PREFIX_BYTES = "FS1:".getBytes(StandardCharsets.US_ASCII);
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_BITS = 128;

    private final SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public PatientDataEncryptionService(
            @Value("${app.patient-data.encryption.key:}") String base64Key) {
        String trimmed = base64Key == null ? "" : base64Key.trim();
        if (trimmed.isEmpty()) {
            this.secretKey = null;
            log.warn("app.patient-data.encryption.key is unset; prescription payloads are stored in plaintext. "
                    + "Set APP_PATIENT_DATA_ENCRYPTION_KEY for production.");
        } else {
            byte[] raw = Base64.getDecoder().decode(trimmed);
            if (raw.length != 32) {
                throw new IllegalStateException(
                        "APP_PATIENT_DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)");
            }
            this.secretKey = new SecretKeySpec(raw, "AES");
        }
    }

    public boolean isEnabled() {
        return secretKey != null;
    }

    public byte[] encrypt(byte[] plaintext) {
        if (plaintext == null || plaintext.length == 0 || secretKey == null) {
            return plaintext;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext);
            ByteBuffer buf = ByteBuffer.allocate(PREFIX_BYTES.length + iv.length + ciphertext.length);
            buf.put(PREFIX_BYTES);
            buf.put(iv);
            buf.put(ciphertext);
            return buf.array();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to encrypt patient data field", e);
        }
    }

    public byte[] decrypt(byte[] stored) {
        if (stored == null || stored.length == 0 || secretKey == null) {
            return stored;
        }
        if (!looksEncrypted(stored)) {
            return stored;
        }
        try {
            byte[] iv = Arrays.copyOfRange(stored, PREFIX_BYTES.length, PREFIX_BYTES.length + GCM_IV_LENGTH);
            byte[] ciphertext = Arrays.copyOfRange(stored, PREFIX_BYTES.length + GCM_IV_LENGTH, stored.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(ciphertext);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to decrypt patient data field", e);
        }
    }

    public static boolean looksEncrypted(byte[] stored) {
        if (stored == null || stored.length < PREFIX_BYTES.length + GCM_IV_LENGTH + 2) {
            return false;
        }
        for (int i = 0; i < PREFIX_BYTES.length; i++) {
            if (stored[i] != PREFIX_BYTES[i]) {
                return false;
            }
        }
        return true;
    }

    /** Deterministic fingerprint for non-secret indexing (not reversible). */
    public String sha256Hex(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
