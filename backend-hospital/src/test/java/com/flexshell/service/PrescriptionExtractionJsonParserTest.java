package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PrescriptionExtractionJsonParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void extractsNumericVitalsFromRootFields() throws Exception {
        String json = """
                {
                  "patient_age": "2Y 0M 2D",
                  "diagnosis": "fever / 1 day",
                  "medicines": ["Syp CALPOL 250"],
                  "investigations": ["Throat swab QS"],
                  "weight_kg": 12.2,
                  "temperature_f": 101.4
                }
                """;
        EducationPrescriptionTranscribeData data =
                PrescriptionExtractionJsonParser.fromJson(objectMapper.readTree(json));
        assertEquals(12.2, data.weightKg());
        assertEquals(101.4, data.temperatureF());
        assertEquals(List.of("Syp CALPOL 250"), data.medicines());
        assertEquals(List.of("Throat swab QS"), data.investigations());
        assertNotNull(data.diagnosis());
    }

    @Test
    void extractsVitalsFromVitalsStringWhenDiagnosisOmitsThem() throws Exception {
        String json = """
                {
                  "patient_age": "2Y 0M 2D",
                  "diagnosis": "fever / cough",
                  "vitals": "wt - 12.2 kg\\nT - 101.4 F",
                  "medicines": ["Syp CALPOL"]
                }
                """;
        EducationPrescriptionTranscribeData data =
                PrescriptionExtractionJsonParser.fromJson(objectMapper.readTree(json));
        assertEquals(12.2, data.weightKg());
        assertEquals(101.4, data.temperatureF());
    }
}
