package com.flexshell.growth;

import com.flexshell.controller.dto.MidParentalHeightDto;
import com.flexshell.controller.dto.WhoCurvePointDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class MidParentalHeightService {

    private static final int GENETIC_CURVE_FROM_MONTHS = 0;
    private static final int GENETIC_CURVE_TO_MONTHS = 60;

    private final WhoPercentileService whoPercentileService;

    public MidParentalHeightService(WhoPercentileService whoPercentileService) {
        this.whoPercentileService = whoPercentileService;
    }

    public MidParentalHeightDto compute(
            String sex,
            BigDecimal motherHeightCm,
            BigDecimal fatherHeightCm,
            Double ageMonthsForExpected
    ) {
        MidParentalHeightDto dto = new MidParentalHeightDto();
        dto.setMotherHeightCm(motherHeightCm);
        dto.setFatherHeightCm(fatherHeightCm);

        Double mother = toDouble(motherHeightCm);
        Double father = toDouble(fatherHeightCm);
        boolean complete = MidParentalHeightSupport.isValidParentHeight(mother)
                && MidParentalHeightSupport.isValidParentHeight(father);
        dto.setComplete(complete);
        if (!complete) {
            dto.setGeneticTargetCurve(List.of());
            return dto;
        }

        double target = MidParentalHeightSupport.computeTargetHeightCm(sex, mother, father);
        double rangeLow = target - MidParentalHeightSupport.TARGET_RANGE_CM;
        double rangeHigh = target + MidParentalHeightSupport.TARGET_RANGE_CM;
        dto.setTargetAdultHeightCm(toDecimal(target));
        dto.setTargetRangeLowCm(toDecimal(rangeLow));
        dto.setTargetRangeHighCm(toDecimal(rangeHigh));

        double geneticZ = MidParentalHeightSupport.geneticTargetZScore(sex, target);
        List<WhoCurvePointDto> curve = new ArrayList<>();
        for (int month = GENETIC_CURVE_FROM_MONTHS; month <= GENETIC_CURVE_TO_MONTHS; month++) {
            double value = whoPercentileService.valueForZScore(WhoGrowthMetric.LHFA, sex, month, geneticZ);
            curve.add(new WhoCurvePointDto((double) month, value));
        }
        dto.setGeneticTargetCurve(curve);

        if (ageMonthsForExpected != null && ageMonthsForExpected >= 0.0) {
            double expected = whoPercentileService.valueForZScore(
                    WhoGrowthMetric.LHFA,
                    sex,
                    ageMonthsForExpected,
                    geneticZ
            );
            dto.setExpectedHeightAtAgeCm(toDecimal(expected));
            dto.setExpectedHeightAgeMonths(toDecimal(ageMonthsForExpected));
        }

        return dto;
    }

    private static Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private static BigDecimal toDecimal(double value) {
        return BigDecimal.valueOf(MidParentalHeightSupport.round1(value)).setScale(1, RoundingMode.HALF_UP);
    }
}
