package com.flexshell.prescription;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MedicalTermsGlossaryTest {

    private MedicalTermsGlossary glossary;

    @BeforeEach
    void setUp() {
        glossary = new MedicalTermsGlossary(new ObjectMapper(), true);
        glossary.loadGlossary();
    }

    @Test
    void correctsWalfiToWalriInDiagnosisPhrase() {
        String corrected = glossary.normalizeClinicalText("F/U/C WALFI");
        assertEquals("F/U/C WALRI", corrected);
    }

    @Test
    void correctsFullWalphChestToFullWalriChest() {
        assertEquals("Full WALRI chest", glossary.normalizeClinicalText("FULL WALPH chest"));
    }

    @Test
    void correctsWalphTokenToWalri() {
        assertEquals("Full WALRI chest", glossary.normalizeClinicalText("Full WALPH chest"));
    }

    @Test
    void correctsCaseInsensitiveAlias() {
        assertEquals("WALRI", glossary.normalizeClinicalText("walfi"));
    }

    @Test
    void normalizerUpdatesTranscribeDiagnosis() {
        EducationPrescriptionTranscribeData raw = sample("F/U/C WALFI", "Neb Levoline 0.63");
        EducationPrescriptionTranscribeData normalized = MedicalTermsGlossaryNormalizer.normalize(raw, glossary);
        assertEquals("F/U/C WALRI", normalized.diagnosis());
        assertTrue(normalized.medications().contains("Levolin"));
    }

    @Test
    void leavesNotStatedUntouched() {
        EducationPrescriptionTranscribeData raw = sample("Not stated", "Not stated");
        EducationPrescriptionTranscribeData normalized = MedicalTermsGlossaryNormalizer.normalize(raw, glossary);
        assertEquals("Not stated", normalized.diagnosis());
    }

    private static EducationPrescriptionTranscribeData sample(String diagnosis, String medications) {
        return new EducationPrescriptionTranscribeData(
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                diagnosis,
                medications,
                List.of(medications),
                List.of(),
                List.of(),
                "",
                "",
                ""
        );
    }
}
