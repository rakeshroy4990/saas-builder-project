package com.flexshell.growth;

import java.util.Locale;

/**
 * Mid-parental (target) height from biological parent heights (Tanner formula, cm).
 */
public final class MidParentalHeightSupport {

    /** Sex adjustment added for boys, subtracted for girls. */
    public static final double SEX_ADJUSTMENT_CM = 13.0;
    /** Typical expected adult range is target ± this margin (cm). */
    public static final double TARGET_RANGE_CM = 8.5;

    private static final double ADULT_MEAN_MALE_CM = 176.0;
    private static final double ADULT_SD_MALE_CM = 7.0;
    private static final double ADULT_MEAN_FEMALE_CM = 163.0;
    private static final double ADULT_SD_FEMALE_CM = 6.5;

    private static final double MIN_PARENT_HEIGHT_CM = 100.0;
    private static final double MAX_PARENT_HEIGHT_CM = 250.0;

    private MidParentalHeightSupport() {
    }

    public static boolean isValidParentHeight(Double heightCm) {
        if (heightCm == null) {
            return false;
        }
        return heightCm >= MIN_PARENT_HEIGHT_CM && heightCm <= MAX_PARENT_HEIGHT_CM;
    }

    public static double computeTargetHeightCm(String sex, double motherHeightCm, double fatherHeightCm) {
        String normalized = normalizeSex(sex);
        double sum = motherHeightCm + fatherHeightCm;
        if ("male".equals(normalized)) {
            return (sum + SEX_ADJUSTMENT_CM) / 2.0;
        }
        return (sum - SEX_ADJUSTMENT_CM) / 2.0;
    }

    public static double geneticTargetZScore(String sex, double targetAdultHeightCm) {
        boolean male = "male".equals(normalizeSex(sex));
        double mean = male ? ADULT_MEAN_MALE_CM : ADULT_MEAN_FEMALE_CM;
        double sd = male ? ADULT_SD_MALE_CM : ADULT_SD_FEMALE_CM;
        return (targetAdultHeightCm - mean) / sd;
    }

    public static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static String normalizeSex(String sex) {
        if (sex == null || sex.isBlank()) {
            return "male";
        }
        return sex.trim().toLowerCase(Locale.ROOT);
    }
}
