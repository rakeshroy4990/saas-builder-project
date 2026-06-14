package com.flexshell.service;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.prescription.PatientPrescriptionSearchTextBuilder;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PatientPrescriptionSearchTextBuilderTest {

    @Test
    void includesDiagnosisMedicinesDosageOnly() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "SVASTHA HOSPITAL",
                "OPD CARD",
                "SVH-1",
                "OPB1",
                "08/05/2026",
                "Mast Deevansh",
                "1Y",
                "MALE",
                "1Y / MALE",
                "DERMATOLOGY",
                "Dr. Smith",
                "Bangalore",
                "9999999999",
                "",
                "Seborrheic Dermatitis",
                "",
                List.of("NIZRAL 2% Shampoo", "T. bact Cream"),
                List.of("twice a week", "twice daily for 2 weeks"),
                List.of(),
                List.of(),
                "Dr. Smith",
                "08/05/2026",
                "Follow-up charges applicable after 4 days",
                null,
                null
        );

        String searchText = PatientPrescriptionSearchTextBuilder.build(data);

        assertTrue(searchText.contains("Seborrheic Dermatitis"));
        assertTrue(searchText.contains("NIZRAL 2% Shampoo"));
        assertTrue(searchText.contains("twice a week"));
        assertFalse(searchText.toLowerCase().contains("mast deevansh"));
        assertFalse(searchText.toLowerCase().contains("svastha"));
        assertFalse(searchText.toLowerCase().contains("dr. smith"));
        assertFalse(searchText.toLowerCase().contains("follow-up charges"));
    }

    @Test
    void includesClinicalNotesWhenNotAdmin() {
        EducationPrescriptionTranscribeData data = sampleWithNotes("Avoid sun exposure for 2 weeks");
        String searchText = PatientPrescriptionSearchTextBuilder.build(data);
        assertTrue(searchText.contains("Avoid sun exposure"));
    }

    @Test
    void excludesAdminFooterNotes() {
        EducationPrescriptionTranscribeData data = sampleWithNotes("Follow-up charges applicable after 4 days");
        String searchText = PatientPrescriptionSearchTextBuilder.build(data);
        assertFalse(searchText.toLowerCase().contains("follow-up charges"));
    }

    private static EducationPrescriptionTranscribeData sampleWithNotes(String notes) {
        return new EducationPrescriptionTranscribeData(
                "", "", "", "", "", "", "", "", "", "", "", "", "", "",
                "Allergic rhinitis",
                "",
                List.of("Cetirizine 10mg"),
                List.of("once daily"),
                List.of(),
                List.of(),
                "",
                "",
                notes,
                null,
                null
        );
    }
}
