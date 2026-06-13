package com.flexshell.growth;

import com.flexshell.controller.dto.WhoCurvePointDto;
import com.flexshell.controller.dto.WhoPercentileCurvesDto;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class WhoPercentileService {

    private static final double[] CURVE_PERCENTILES = {3.0, 15.0, 50.0, 85.0, 97.0};
    private static final String[] CURVE_KEYS = {"P3", "P15", "P50", "P85", "P97"};

    private final WhoDataLoader dataLoader;
    private final Map<String, WhoPercentileCurvesDto> curveCache = new ConcurrentHashMap<>();

    public WhoPercentileService(WhoDataLoader dataLoader) {
        this.dataLoader = dataLoader;
    }

    public Double computePercentile(WhoGrowthMetric metric, String sex, double ageMonths, double measurement) {
        WhoLmsTable table = dataLoader.table(metric, sex);
        double clampedAge = clampAge(ageMonths, table);
        WhoLmsRow lms = table.interpolate(clampedAge);
        double z = WhoNormalDistribution.zFromMeasurement(measurement, lms);
        return WhoNormalDistribution.percentileFromZ(z);
    }

    public WhoPercentileCurvesDto getPercentileCurves(
            WhoGrowthMetric metric,
            String sex,
            int fromMonths,
            int toMonths
    ) {
        String cacheKey = metric.wireKey() + "_" + sex + "_" + fromMonths + "_" + toMonths;
        WhoPercentileCurvesDto cached = curveCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }
        WhoLmsTable table = dataLoader.table(metric, sex);
        int start = Math.max(0, fromMonths);
        int end = Math.min((int) table.maxAgeMonths(), toMonths);
        if (end < start) {
            throw new IllegalArgumentException("WHO_RANGE_INVALID");
        }

        Map<String, List<WhoCurvePointDto>> curves = new LinkedHashMap<>();
        for (String key : CURVE_KEYS) {
            curves.put(key, new ArrayList<>());
        }

        for (int month = start; month <= end; month++) {
            WhoLmsRow lms = table.interpolate(month);
            for (int i = 0; i < CURVE_PERCENTILES.length; i++) {
                double value = WhoNormalDistribution.valueForPercentile(CURVE_PERCENTILES[i], lms);
                curves.get(CURVE_KEYS[i]).add(new WhoCurvePointDto((double) month, round2(value)));
            }
        }

        WhoPercentileCurvesDto result = new WhoPercentileCurvesDto(metric.wireKey(), sex, curves);
        curveCache.put(cacheKey, result);
        return result;
    }

    private static double clampAge(double ageMonths, WhoLmsTable table) {
        return Math.max(table.minAgeMonths(), Math.min(table.maxAgeMonths(), ageMonths));
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
