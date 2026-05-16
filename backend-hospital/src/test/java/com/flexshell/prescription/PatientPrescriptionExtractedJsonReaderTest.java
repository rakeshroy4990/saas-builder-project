package com.flexshell.prescription;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityDetailsResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PatientPrescriptionExtractedJsonReaderTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void readsDiagnosisAndMedicinesArray() throws Exception {
    String json =
        """
        {
          "diagnosis": "fever 1 day, cough, nasal mild congestion",
          "medicines": [
            "Syp CALPOL 250: 3.5 ml, SOS if T > 99.5",
            "Syp Ibuprofen 100: 3.5 ml, SOS if T > 103"
          ]
        }
        """;
    PatientPrescriptionSimilarityDetailsResponse details =
        PatientPrescriptionExtractedJsonReader.read(objectMapper, json);
    assertEquals("fever 1 day, cough, nasal mild congestion", details.diagnosis());
    assertEquals(2, details.medicines().size());
    assertTrue(details.medicines().get(0).contains("CALPOL"));
  }
}
