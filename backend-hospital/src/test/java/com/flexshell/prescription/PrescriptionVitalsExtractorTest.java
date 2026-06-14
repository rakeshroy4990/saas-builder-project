package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PrescriptionVitalsExtractorTest {

    @Test
    void parsesAgeFromDoctorSummaryAgeLine() {
        String summary = """
                Patient: Baby IVANSHI
                Age: 1Y 7M
                Weight: 9.6 kg
                """;
        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromAnyText(summary);
        assertEquals(9.6, vitals.weightKg());
        assertEquals(19.0, vitals.ageMonths());
    }

    @Test
        String diagnosis = """
                fever / 1 day
                cough
                H/o travel (+)
                O/E Nose mild cong.
                wt - 12.2 kg
                T - 101.4 F
                Rhinitis
                """;

        EducationPrescriptionTranscribeData data = sample("2Y 0M 2D / MALE", "2Y 0M 2D", diagnosis);
        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromTranscribe(data);

        assertEquals(12.2, vitals.weightKg());
        assertEquals(101.4, vitals.temperatureF());
        assertEquals(24.0, vitals.ageMonths());
    }

    @Test
    void prefersStructuredVitalsFromJsonFields() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "SVASTHA HOSPITAL", "OPD CARD", "", "", "", "Mast VEDA", "2Y 0M 2D", "MALE",
                "2Y 0M 2D / MALE", "PAEDIATRIC", "", "", "", "", "fever", "Syp CALPOL", List.of("Syp CALPOL"),
                List.of(), List.of(), List.of(), "", "", "", 12.2, 101.4
        );

        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromTranscribe(data);
        assertEquals(12.2, vitals.weightKg());
        assertEquals(101.4, vitals.temperatureF());
    }

    @Test
    void enrichFillsMissingStructuredVitalsFromText() {
        EducationPrescriptionTranscribeData sparse = sample(
                "2Y 0M 2D / MALE",
                "2Y 0M 2D",
                "wt - 12.2 kg, T - 101.4 F"
        );
        EducationPrescriptionTranscribeData enriched = PrescriptionVitalsExtractor.enrich(sparse);
        assertEquals(12.2, enriched.weightKg());
        assertEquals(101.4, enriched.temperatureF());
    }

    @Test
    void parseWeightKg_handlesCommonShorthand() {
        assertEquals(12.2, PrescriptionVitalsExtractor.parseWeightKg("wt - 12.2 kg"));
        assertNull(PrescriptionVitalsExtractor.parseWeightKg("no vitals"));
    }

    @Test
    void parseWeightKg_handlesWeightEqualsFormat() {
        assertEquals(9.6, PrescriptionVitalsExtractor.parseWeightKg("Weight = 9.6 kg"));
        assertEquals(12.2, PrescriptionVitalsExtractor.parseWeightKg("wt-12.2kg"));
    }

    @Test
    void flattenJsonText_findsVitalsInUnmappedKeys() {
        String json = """
                {"diagnosis":"fever","vitals":"wt - 12.2 kg","other":"T - 101.4 F"}
                """;
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        try {
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(json);
            String flat = PrescriptionVitalsExtractor.flattenJsonText(node);
            PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromAnyText(flat);
            assertEquals(12.2, vitals.weightKg());
            assertEquals(101.4, vitals.temperatureF());
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Test
    void parsesVitalsFromNotesWhenDiagnosisOmitsThem() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "", "", "", "", "", "", "2Y 0M 2D", "MALE", "2Y 0M 2D / MALE", "", "", "", "", "",
                "fever / 1 day, cough, Rhinitis", "", List.of(), List.of(), List.of(), List.of(), "", "",
                "wt - 12.2 kg\nT - 101.4 F", null, null
        );
        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromTranscribe(data);
        assertEquals(12.2, vitals.weightKg());
        assertEquals(101.4, vitals.temperatureF());
    }

    @Test
    void parseWeightKg_handlesSvasthaOpdFormat() {
        assertEquals(21.7, PrescriptionVitalsExtractor.parseWeightKg("Wt - 21.7 kg"));
        assertEquals(21.7, PrescriptionVitalsExtractor.parseWeightKg("Wt. 21.7 kg"));
    }

    @Test
    void parseTemperatureF_handlesTempWithDegreeSymbol() {
        assertEquals(98.7, PrescriptionVitalsExtractor.parseTemperatureF("Temp - 98.7°F"));
        assertEquals(98.7, PrescriptionVitalsExtractor.parseTemperatureF("Temp - 98.7 F"));
    }

    @Test
    void fromVitalsModelJson_readsStructuredFields() {
        String json = """
                {"vitals":"Wt - 21.7 kg\\nTemp - 98.7 F","weight_kg":21.7,"temperature_f":98.7}
                """;
        PrescriptionVitalsExtractor.PrescriptionVitals vitals =
                PrescriptionVitalsExtractor.fromVitalsModelJson(
                        json,
                        new com.fasterxml.jackson.databind.ObjectMapper()
                );
        assertEquals(21.7, vitals.weightKg());
        assertEquals(98.7, vitals.temperatureF());
    }

    @Test
    void parseTemperatureF_handlesCommonShorthand() {
        assertEquals(101.4, PrescriptionVitalsExtractor.parseTemperatureF("T - 101.4 F"));
        assertEquals(99.5, PrescriptionVitalsExtractor.parseTemperatureF("temp 99.5°F"));
    }

    private static EducationPrescriptionTranscribeData sample(String ageGender, String patientAge, String diagnosis) {
        return new EducationPrescriptionTranscribeData(
                "", "", "", "", "", "", patientAge, "", ageGender, "", "", "", "", "",
                diagnosis, "", List.of(), List.of(), List.of(), List.of(), "", "", "", null, null
        );
    }
}
