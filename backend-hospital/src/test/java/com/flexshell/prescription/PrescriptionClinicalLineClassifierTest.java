package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PrescriptionClinicalLineClassifierTest {

    @Test
    void movesThroatSwabOutOfMedicines() {
        EducationPrescriptionTranscribeData input = sample(
                List.of("Throat swab QS", "Syp Advent 457"),
                List.of()
        );
        EducationPrescriptionTranscribeData out = PrescriptionClinicalLineClassifier.reclassify(input);
        assertEquals(List.of("Syp Advent 457"), out.medicines());
        assertEquals(List.of("Throat swab QS"), out.investigations());
    }

    @Test
    void recognizesSypSyrupAsMedicine() {
        assertFalse(PrescriptionClinicalLineClassifier.looksLikeInvestigation("Syp CALPOL 250"));
        assertFalse(PrescriptionClinicalLineClassifier.looksLikeInvestigation("Syp Advent 457 (4 ml BD)"));
    }

    @Test
    void normalizesSypPrefixForLookup() {
        assertEquals("Advent 457", PrescriptionClinicalLineClassifier.normalizeDrugNameForLookup(
                "Syp Advent 457 (4 ml twice a day for 7-10 days)"
        ));
        assertEquals("ORS", PrescriptionClinicalLineClassifier.normalizeDrugNameForLookup("Syp oral rachet"));
    }

    @Test
    void normalizesNumberedInjAndSyrpLines() {
        assertEquals("Hapibev", PrescriptionClinicalLineClassifier.normalizeDrugNameForLookup(
                "1) Inj Hapibev (Inactivated HepB) (I)"
        ));
        assertEquals("Influvac Tetra", PrescriptionClinicalLineClassifier.normalizeDrugNameForLookup(
                "2) Inj Influvac Tetra (I)"
        ));
        assertEquals("Calpol 250", PrescriptionClinicalLineClassifier.normalizeDrugNameForLookup(
                "-> Syrp Calpol 250 3ml SOS if T > 99.5"
        ));
        assertFalse(PrescriptionClinicalLineClassifier.looksLikeInvestigation("1) Inj Hapibev"));
        assertFalse(PrescriptionClinicalLineClassifier.looksLikeInvestigation("-> Syrp Calpol 250"));
    }

    @Test
    void extractsInlineSosDosageFromSyrpLine() {
        assertEquals("3ml SOS if T > 99.5", PrescriptionClinicalLineClassifier.extractInlineDosageHint(
                "-> Syrp Calpol 250 3ml SOS if T > 99.5"
        ));
    }

    @Test
    void parserParsesOpdCardVaccinesAndSosCalpol() {
        Map<String, Object> extracted = Map.of(
                "medicines",
                List.of(
                        "1) Inj Hapibev (Inactivated HepB) (I)",
                        "2) Inj Influvac Tetra (I)",
                        "-> Syrp Calpol 250 3ml SOS if T > 99.5"
                )
        );
        List<Map<String, Object>> meds = PrescriptionMedicationParser.fromExtractedData(extracted);
        assertEquals(3, meds.size());
        assertEquals("Hapibev", meds.get(0).get("name"));
        assertEquals("im", meds.get(0).get("route"));
        assertEquals("Influvac Tetra", meds.get(1).get("name"));
        assertEquals("im", meds.get(1).get("route"));
        assertEquals("Calpol 250", meds.get(2).get("name"));
        assertEquals(150.0, (Double) meds.get(2).get("dose_mg"), 0.1);
        assertEquals("oral", meds.get(2).get("route"));
    }

    @Test
    void parserSkipsInvestigationsAndParsesSyrupDose() {
        Map<String, Object> extracted = Map.of(
                "medicines",
                List.of(
                        "Throat swab QS",
                        "Syp Advent 457 (4 ml twice a day for 7 days)",
                        "Syp oral rachet (1 ml twice a day for 5 days)"
                )
        );
        List<Map<String, Object>> meds = PrescriptionMedicationParser.fromExtractedData(extracted);
        assertEquals(2, meds.size());
        assertEquals("Advent 457", meds.get(0).get("name"));
        assertEquals(365.6, (Double) meds.get(0).get("dose_mg"), 0.1);
        assertEquals(2, meds.get(0).get("frequency_per_day"));
        assertEquals("ORS", meds.get(1).get("name"));
    }

    private static EducationPrescriptionTranscribeData sample(List<String> medicines, List<String> investigations) {
        return new EducationPrescriptionTranscribeData(
                "", "", "", "", "", "", "", "", "", "", "", "", "", "",
                "fever", String.join("\n", medicines), medicines, List.of(), List.of(), investigations,
                "", "", "", null, null
        );
    }
}
