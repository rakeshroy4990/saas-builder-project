package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OpdPrintedFieldExtractorTest {

    @Test
    void fillsMissingHeaderFieldsFromOpdPlainText() {
        String pdfText = """
                SVASTHA HOSPITAL
                OPD CARD
                Patient Name : Mast Deevansh
                Reg. No. : SVH-1-169788
                Appointment Date : 08/05/2026 6:25PM
                Age / Gender : 1Y 0M 17D / MALE
                Consultant : DR. MANJUNATH KADANURUGANGE GOWDA
                Department : DERMATOLOGY
                Mobile No. : 9380765147
                Diagnosis: Seborrheic Dermatitis
                """;
        EducationPrescriptionTranscribeData sparse = new EducationPrescriptionTranscribeData(
                "SVASTHA HOSPITAL",
                "OPD CARD",
                "",
                "",
                "",
                "Mast Deevansh",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "Seborrheic Dermatitis",
                "",
                java.util.List.of("NIZRAL shampoo"),
                java.util.List.of(),
                java.util.List.of(),
                java.util.List.of(),
                "",
                "",
                "",
                null,
                null
        );

        EducationPrescriptionTranscribeData enriched = OpdPrintedFieldExtractor.enrich(sparse, pdfText);

        assertEquals("08/05/2026 6:25PM", enriched.appointmentDate());
        assertEquals("DERMATOLOGY", enriched.department());
        assertEquals("DR. MANJUNATH KADANURUGANGE GOWDA", enriched.consultant());
        assertEquals("9380765147", enriched.mobileNumber());
        assertEquals("SVH-1-169788", enriched.registrationNumber());
        assertEquals("1Y 0M 17D", enriched.patientAge());
        assertEquals("MALE", enriched.patientGender());
    }

    @Test
    void splitsCombinedAgeGenderWhenModelReturnsOnlyThatField() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "", "", "", "", "", "", "", "", "1Y 0M 17D / MALE",
                "", "", "", "", "", "Fever", "", java.util.List.of(), java.util.List.of(),
                java.util.List.of(), java.util.List.of(), "", "", "", null, null
        );

        EducationPrescriptionTranscribeData split = OpdPrintedFieldExtractor.splitAgeGenderIfNeeded(data);

        assertEquals("1Y 0M 17D", split.patientAge());
        assertEquals("MALE", split.patientGender());
    }
}
