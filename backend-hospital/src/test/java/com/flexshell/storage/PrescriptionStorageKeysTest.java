package com.flexshell.storage;

import com.flexshell.auth.UserRole;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrescriptionStorageKeysTest {

    @Test
    void buildKeyWithoutPrescriptionsPrefix() {
        UUID id = UUID.fromString("11111111-1111-1111-1111-111111111111");
        assertEquals(
                "patient-42/11111111-1111-1111-1111-111111111111.pdf",
                PrescriptionStorageKeys.build("patient-42", id, "pdf")
        );
    }

    @Test
    void patientCanReadOwnLegacyAndNewKeys() {
        assertTrue(PrescriptionStorageKeys.canActorRead("u1", UserRole.PATIENT, "u1/file.pdf"));
        assertTrue(PrescriptionStorageKeys.canActorRead("u1", UserRole.PATIENT, "prescriptions/u1/file.pdf"));
        assertFalse(PrescriptionStorageKeys.canActorRead("u1", UserRole.PATIENT, "u2/file.pdf"));
    }

    @Test
    void doctorCanReadAnyKey() {
        assertTrue(PrescriptionStorageKeys.canActorRead("doc", UserRole.DOCTOR, "u2/file.pdf"));
    }
}
