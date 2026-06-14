package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrescriptionSummarySupportTest {

    @Test
    void formatsOpdSummaryWithMedicinesSection() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "SVSTHA HOSPITAL", "OPD CARD", "", "", "18/02/2026", "Baby IVANSHI", "1Y 7M", "FEMALE", "",
                "PAEDIATRIC", "DR. SWATI", "", "", "", "Came for Immun", "",
                List.of("1) Inj Hapibev", "-> Syrp Calpol 250 3ml SOS"),
                List.of(), List.of(), List.of(),
                "", "", "", 9.6, 98.4
        );
        String summary = PrescriptionSummarySupport.formatDoctorSummary(data);
        assertTrue(summary.contains("Weight: 9.6 kg"));
        assertTrue(summary.contains("Medicines:"));
        assertTrue(summary.contains("1) Inj Hapibev"));
    }

    @Test
    void parsesEditedMedicinesFromSummary() {
        String summary = """
                Patient: Baby IVANSHI
                Weight: 9.6 kg
                Temperature: 98.4 °F

                Diagnosis:
                Came for Immun

                Medicines:
                1) Inj Hapibev (Inactivated HepB)
                2) Inj Influvac Tetra
                -> Syrp Calpol 250 3ml SOS if T > 99.5
                """;
        List<String> medicines = PrescriptionSummarySupport.parseMedicineLines(summary);
        assertEquals(3, medicines.size());
        Map<String, Object> extracted = PrescriptionSummarySupport.toExtractedDataMap(summary);
        assertEquals(9.6, extracted.get("weight_kg"));
        List<Map<String, Object>> meds = PrescriptionMedicationParser.fromExtractedData(extracted);
        assertEquals(3, meds.size());
        assertEquals("Hapibev", meds.get(0).get("name"));
        assertEquals("Calpol 250", meds.get(2).get("name"));
    }
}
