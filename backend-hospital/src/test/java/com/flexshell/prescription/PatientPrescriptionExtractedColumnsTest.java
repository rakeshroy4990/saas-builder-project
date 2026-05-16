package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PatientPrescriptionExtractedColumnsTest {

    @Test
    void mapsOpdExtractToColumnValues() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "SVASTHA HOSPITAL",
                "OPD CARD",
                "SVH-1-163723",
                "OPB12549276",
                "18/02/2026 7:15PM",
                "Baby IVANSHI SINGH YADAV",
                "1Y 7M 28D",
                "FEMALE",
                "1Y 7M 28D/FEMALE",
                "PAEDIATRIC",
                "DR. SWATI PANDEY",
                "Whitefield, Bangalore",
                "9538364254",
                "",
                "Came for Immunization",
                "",
                List.of("Inj Hapibev (HepB)"),
                List.of(),
                List.of(),
                "DR. SWATI PANDEY",
                "18/02/2026 7:15PM",
                "Weight = 9.6 kg"
        );

        PatientPrescriptionExtractedColumns.Values cols = PatientPrescriptionExtractedColumns.from(data);

        assertEquals("DR. SWATI PANDEY", cols.doctorName());
        assertEquals("PAEDIATRIC", cols.department());
        assertEquals("Baby IVANSHI SINGH YADAV", cols.patientName());
        assertEquals("FEMALE", cols.patientGender());
    }

    @Test
    void blankFieldsBecomeNull() {
        EducationPrescriptionTranscribeData data = new EducationPrescriptionTranscribeData(
                "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", List.of(),
                List.of(), List.of(), "", "", ""
        );
        PatientPrescriptionExtractedColumns.Values cols = PatientPrescriptionExtractedColumns.from(data);
        assertNull(cols.doctorName());
        assertNull(cols.department());
        assertNull(cols.patientName());
        assertNull(cols.patientGender());
    }
}
