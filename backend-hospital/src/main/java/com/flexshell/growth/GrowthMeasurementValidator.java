package com.flexshell.growth;

import java.math.BigDecimal;

public final class GrowthMeasurementValidator {

    private GrowthMeasurementValidator() {
    }

    public static void validateHeight(BigDecimal heightCm) {
        if (heightCm == null) {
            return;
        }
        double value = heightCm.doubleValue();
        if (value < 30.0 || value > 250.0) {
            throw new IllegalArgumentException("GROWTH_HEIGHT_OUT_OF_RANGE");
        }
    }

    public static void validateWeight(BigDecimal weightKg) {
        if (weightKg == null) {
            return;
        }
        double value = weightKg.doubleValue();
        if (value < 0.5 || value > 200.0) {
            throw new IllegalArgumentException("GROWTH_WEIGHT_OUT_OF_RANGE");
        }
    }

    public static void validateHeadCircumference(BigDecimal hcCm) {
        if (hcCm == null) {
            return;
        }
        double value = hcCm.doubleValue();
        if (value < 20.0 || value > 70.0) {
            throw new IllegalArgumentException("GROWTH_HC_OUT_OF_RANGE");
        }
    }

    public static void validateSpo2(Double spo2) {
        if (spo2 == null) {
            return;
        }
        if (spo2 < 50.0 || spo2 > 100.0) {
            throw new IllegalArgumentException("VITAL_SPO2_OUT_OF_RANGE");
        }
    }

    public static void validateBp(Integer systolic, Integer diastolic) {
        if (systolic != null && (systolic < 50 || systolic > 250)) {
            throw new IllegalArgumentException("VITAL_BP_OUT_OF_RANGE");
        }
        if (diastolic != null && (diastolic < 30 || diastolic > 200)) {
            throw new IllegalArgumentException("VITAL_BP_OUT_OF_RANGE");
        }
    }
}
