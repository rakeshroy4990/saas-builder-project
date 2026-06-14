package com.flexshell.prescription;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class PrescriptionMedicationParserTest {

    @Test
    void parsesOcrMedicinesAndDosageLines() {
        Map<String, Object> extracted = new LinkedHashMap<>();
        extracted.put("medicines", List.of("Crocin 250", "Augmentin 625"));
        extracted.put("dosage", List.of("TDS after food", "BD x 5 days"));

        List<Map<String, Object>> meds = PrescriptionMedicationParser.fromExtractedData(extracted);
        assertEquals(2, meds.size());
        assertEquals("Crocin 250", meds.get(0).get("name"));
        assertNull(meds.get(0).get("dose_mg"));
        assertEquals(3, meds.get(0).get("frequency_per_day"));
        assertEquals(625.0, meds.get(1).get("dose_mg"));
        assertEquals(2, meds.get(1).get("frequency_per_day"));
    }

    @Test
    void parsesSypAdvent457MlDoseToMg() {
        Map<String, Object> extracted = Map.of(
                "medicines",
                List.of("Syp Advent 457 (4 ml twice a day for 7 days)")
        );
        List<Map<String, Object>> meds = PrescriptionMedicationParser.fromExtractedData(extracted);
        assertEquals(1, meds.size());
        assertEquals("Advent 457", meds.get(0).get("name"));
        assertEquals(365.6, (Double) meds.get(0).get("dose_mg"), 0.1);
        assertEquals(2, meds.get(0).get("frequency_per_day"));
    }

    @Test
    void parseSypAdventDoseFromMlAndStrength() {
        assertEquals(365.6, PrescriptionMedicationParser.parseDoseMg(
                "Syp Advent 457",
                "4 ml twice a day"
        ), 0.1);
    }

    @Test
    void parsesSyrpCalpolSosLine() {
        Map<String, Object> extracted = Map.of(
                "medicines",
                List.of("-> Syrp Calpol 250 3ml SOS if T > 99.5")
        );
        List<Map<String, Object>> meds = PrescriptionMedicationParser.fromExtractedData(extracted);
        assertEquals(1, meds.size());
        assertEquals("Calpol 250", meds.get(0).get("name"));
        assertEquals(150.0, (Double) meds.get(0).get("dose_mg"), 0.1);
        assertNull(meds.get(0).get("frequency_per_day"));
    }

    @Test
    void parseDoseMgFromStrengthText() {
        assertNotNull(PrescriptionMedicationParser.parseDoseMg("500 mg"));
        assertEquals(500.0, PrescriptionMedicationParser.parseDoseMg("500 mg"));
    }

    @Test
    void parseFrequencyFromOd() {
        assertEquals(1, PrescriptionMedicationParser.parseFrequency("OD"));
        assertNull(PrescriptionMedicationParser.parseFrequency(""));
    }
}
