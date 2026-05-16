package com.flexshell.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;

class PrescriptionExtractionJsonParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parsesOpdCardWithPatientDemographics() throws Exception {
        String json = """
                {
                  "hospital_name": "SVASTHA HOSPITAL",
                  "document_type": "OPD CARD",
                  "registration_number": "SVH-1-169788",
                  "receipt_number": "OPB1266126",
                  "appointment_date": "08/05/2026 6:25PM",
                  "patient_name": "Mast Deevansh",
                  "patient_age": "1Y 0M 17D",
                  "patient_gender": "MALE",
                  "age_gender": "1Y 0M 17D / MALE",
                  "department": "DERMATOLOGY",
                  "consultant": "DR. MANJUNATH KADANURUGANGE GOWDA",
                  "address": "Whitefield, Bangalore",
                  "mobile_number": "9380765147",
                  "referred_by": "",
                  "diagnosis": "Seborrheic Dermatitis + folliculitis",
                  "medicines": [
                    "NIZRAL 2% Shampoo: twice a week for 1 month",
                    "T. bact Cream: twice a day for 2 weeks"
                  ],
                  "dosage": [],
                  "advice": ["Mix 3ml shampoo with 3ml water"],
                  "doctor_name": "DR. MANJUNATH KADANURUGANGE GOWDA",
                  "prescription_date": "08/05/2026",
                  "notes": "Follow-up charges applicable after 4 days"
                }
                """;
        EducationPrescriptionTranscribeData data =
                PrescriptionExtractionJsonParser.fromJson(objectMapper.readTree(json));

        assertEquals("SVASTHA HOSPITAL", data.hospitalName());
        assertEquals("Mast Deevansh", data.patientName());
        assertEquals("DERMATOLOGY", data.department());
        assertEquals("Seborrheic Dermatitis + folliculitis", data.diagnosis());
        assertEquals(2, data.medicines().size());

        Map<String, Object> stored = data.toExtractedDataMap();
        assertEquals("Mast Deevansh", stored.get("patient_name"));
        assertEquals("DERMATOLOGY", stored.get("department"));
        assertEquals("9380765147", stored.get("mobile_number"));
        assertEquals("SVH-1-169788", stored.get("registration_number"));
        assertEquals("DR. MANJUNATH KADANURUGANGE GOWDA", stored.get("doctor_name"));
    }

    @Test
    void legacyMedicationsStringSplitsIntoMedicinesArray() throws Exception {
        String json = """
                {"diagnosis": "Fever", "medications": "Paracetamol 500mg\\nTwice daily"}
                """;
        EducationPrescriptionTranscribeData data =
                PrescriptionExtractionJsonParser.fromJson(objectMapper.readTree(json));
        assertEquals("Fever", data.diagnosis());
        assertIterableEquals(
                List.of("Paracetamol 500mg", "Twice daily"),
                data.medicines()
        );
    }
}
