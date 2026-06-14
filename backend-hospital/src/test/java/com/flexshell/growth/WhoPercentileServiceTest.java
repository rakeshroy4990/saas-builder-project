package com.flexshell.growth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ResourceLoader;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WhoPercentileServiceTest {

    private WhoPercentileService service;

    @BeforeEach
    void setUp() {
        WhoDataLoader loader = new WhoDataLoader();
        loader.load();
        service = new WhoPercentileService(loader);
    }

    @Test
    void computePercentile_boyWeightAt12Months_isReasonable() {
        Double percentile = service.computePercentile(WhoGrowthMetric.WFA, "male", 12.0, 9.6);
        assertNotNull(percentile);
        assertTrue(percentile > 40.0 && percentile < 60.0, "Expected near median, got " + percentile);
    }

    @Test
    void getPercentileCurves_returnsFiveBands() {
        var curves = service.getPercentileCurves(WhoGrowthMetric.WFA, "male", 0, 12);
        assertNotNull(curves.getCurves());
        assertTrue(curves.getCurves().containsKey("P50"));
        assertTrue(curves.getCurves().get("P50").size() >= 13);
    }

    @Test
    void getPercentileCurves_lhfaMedianAtBirth_isAbout50cm() {
        var curves = service.getPercentileCurves(WhoGrowthMetric.LHFA, "male", 0, 0);
        double medianAtBirth = curves.getCurves().get("P50").get(0).getValue();
        assertTrue(medianAtBirth > 48.0 && medianAtBirth < 52.0, "Expected ~49.9 cm at birth, got " + medianAtBirth);
    }

    @Test
    void computePercentile_tallLeanToddler_matchesExpectedBmiAndWeight() {
        double ageMonths = 26.8;
        double weightKg = 12.3;
        double heightCm = 95.0;
        double heightM = heightCm / 100.0;
        double bmi = weightKg / (heightM * heightM);

        assertTrue(bmi > 13.5 && bmi < 13.7, "Expected BMI ~13.6, got " + bmi);

        Double weightPct = service.computePercentile(WhoGrowthMetric.WFA, "male", ageMonths, weightKg);
        Double heightPct = service.computePercentile(WhoGrowthMetric.LHFA, "male", ageMonths, heightCm);
        Double bmiPct = service.computePercentile(WhoGrowthMetric.BFA, "male", ageMonths, bmi);

        assertNotNull(weightPct);
        assertNotNull(heightPct);
        assertNotNull(bmiPct);
        assertTrue(weightPct > 35.0 && weightPct < 45.0, "Expected weight ~41st, got " + weightPct);
        assertTrue(heightPct > 90.0, "Expected tall stature percentile, got " + heightPct);
        assertTrue(bmiPct < 5.0, "Expected low BMI-for-age for tall lean child, got " + bmiPct);
    }
}
