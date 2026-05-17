package com.flexshell.storage;

import com.flexshell.auth.UserRole;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * S3 / local object keys for patient prescription files.
 * <p>
 * Bucket: {@code prescription} (see {@link S3PrescriptionFileStorage#DEFAULT_PRESCRIPTION_BUCKET}).
 * Key shape: {@code {patientUserId}/{fileUuid}.{ext}} — no extra {@code prescriptions/} prefix (avoids
 * {@code prescription/prescriptions/...} in the Supabase UI).
 */
public final class PrescriptionStorageKeys {

    /** Legacy keys before bucket/key split was standardized. */
    private static final String LEGACY_PREFIX = "prescriptions/";

    private PrescriptionStorageKeys() {
    }

    public static String build(String patientUserId, UUID fileUuid, String extension) {
        String userId = Objects.toString(patientUserId, "").trim();
        String ext = Objects.toString(extension, "bin").trim().toLowerCase(Locale.ROOT);
        if (ext.startsWith(".")) {
            ext = ext.substring(1);
        }
        if (ext.isBlank()) {
            ext = "bin";
        }
        return userId + "/" + fileUuid + "." + ext;
    }

    public static String normalize(String storagePath) {
        return S3PrescriptionFileStorage.normalizeKey(storagePath);
    }

    public static boolean canActorRead(String actorUserId, UserRole role, String storagePath) {
        String key = normalize(storagePath);
        if (key.isBlank() || key.contains("..")) {
            return false;
        }
        if (role == UserRole.ADMIN || role == UserRole.DOCTOR) {
            return true;
        }
        if (key.startsWith(actorUserId + "/")) {
            return true;
        }
        return key.startsWith(LEGACY_PREFIX + actorUserId + "/");
    }
}
