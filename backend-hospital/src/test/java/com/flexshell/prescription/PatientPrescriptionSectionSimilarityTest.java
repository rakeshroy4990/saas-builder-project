package com.flexshell.prescription;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PatientPrescriptionSectionSimilarityTest {

    @Test
    void parseStructuredQueryText() {
        String query = """
                Diagnosis: Mild fever
                Medications: Paracetamol 250mg
                """;
        var details = PatientPrescriptionSectionSimilarity.parseQueryText(query);
        assertEquals("Mild fever", details.diagnosis());
        assertEquals(1, details.medicines().size());
        assertTrue(details.medicines().get(0).contains("Paracetamol"));
    }

    @Test
    void parseFlatClinicalSearchTextFromTranscribeStyleQuery() {
        String query =
                "Fever 4-5 days, Any cough, Running Nose. Tab Calpol 500mg SOS (can repeat 6th hourly)";
        var details = PatientPrescriptionSectionSimilarity.parseQueryText(query);
        assertEquals("Fever 4-5 days, Any cough, Running Nose", details.diagnosis());
        assertEquals(1, details.medicines().size());
        assertTrue(details.medicines().get(0).contains("Calpol"));
    }

    @Test
    void sectionEmbedTextsIncludesMedicinesFromFlatQuery() {
        String query = "Mild fever. Paracetamol 250mg, Ibuprofen 100mg";
        var details = PatientPrescriptionSectionSimilarity.parseQueryText(query);
        var sections = PatientPrescriptionSectionSimilarity.sectionEmbedTexts(details);
        assertTrue(sections.containsKey(PatientPrescriptionSectionSimilarity.SECTION_DIAGNOSIS));
        assertTrue(sections.containsKey(PatientPrescriptionSectionSimilarity.SECTION_MEDICINES));
    }

    @Test
    void cosineSimilarityPercentIdenticalVectors() {
        List<Double> v = List.of(0.1, 0.2, 0.3);
        double score = PatientPrescriptionSectionSimilarity.cosineSimilarityPercent(v, v);
        assertEquals(100.0, score, 0.01);
    }
}
