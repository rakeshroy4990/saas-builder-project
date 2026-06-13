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
}
