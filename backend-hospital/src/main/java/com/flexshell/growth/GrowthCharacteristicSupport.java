package com.flexshell.growth;

import com.flexshell.controller.dto.GrowthCharacteristicsDto;
import com.flexshell.i18n.HospitalMessageResolver;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Derives parent-friendly growth profile labels (e.g. "Lean tall boy") from WHO percentiles.
 */
public final class GrowthCharacteristicSupport {

    private static final Set<String> ADJECTIVE_TRAITS = Set.of(
            "LEAN", "STOCKY", "SLENDER", "TALL", "SHORT", "LARGE_HEAD"
    );

    private GrowthCharacteristicSupport() {
    }

    public static GrowthCharacteristicsDto derive(
            HospitalMessageResolver messages,
            String localeCode,
            String sex,
            BigDecimal weightPercentile,
            BigDecimal heightPercentile,
            BigDecimal bmiPercentile,
            BigDecimal hcPercentile
    ) {
        List<String> traitCodes = deriveTraitCodes(weightPercentile, heightPercentile, bmiPercentile, hcPercentile);
        List<String> labels = new ArrayList<>();
        for (String code : traitCodes) {
            labels.add(resolveTraitLabel(messages, localeCode, code));
        }
        String sexLabel = resolveSexLabel(messages, localeCode, sex);
        if (!sexLabel.isBlank() && !traitCodes.contains(sexTraitCode(sex))) {
            labels.add(sexLabel);
        }
        String phrase = buildPhrase(messages, localeCode, traitCodes, sex);
        GrowthCharacteristicsDto dto = new GrowthCharacteristicsDto();
        dto.setTraitCodes(traitCodes);
        dto.setLabels(labels);
        dto.setPhrase(phrase);
        return dto;
    }

    static List<String> deriveTraitCodes(
            BigDecimal weightPercentile,
            BigDecimal heightPercentile,
            BigDecimal bmiPercentile,
            BigDecimal hcPercentile
    ) {
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        Double wp = toDouble(weightPercentile);
        Double hp = toDouble(heightPercentile);
        Double bp = toDouble(bmiPercentile);
        Double hcp = toDouble(hcPercentile);

        if (bp != null && bp < 15.0 && (hp == null || hp >= 50.0)) {
            codes.add("LEAN");
        } else if (bp != null && bp > 85.0) {
            codes.add("STOCKY");
        } else if (wp != null && wp < 15.0) {
            codes.add("SLENDER");
        }

        if (hp != null && hp >= 85.0) {
            codes.add("TALL");
        } else if (hp != null && hp <= 15.0) {
            codes.add("SHORT");
        }

        if (wp != null) {
            if (wp >= 15.0 && wp <= 85.0) {
                codes.add("NORMAL_WEIGHT");
            } else if (wp < 15.0) {
                codes.add("UNDERWEIGHT");
            } else {
                codes.add("OVERWEIGHT");
            }
        }

        if (hcp != null && hcp >= 85.0) {
            codes.add("LARGE_HEAD");
        }

        boolean hasAdjective = codes.stream().anyMatch(ADJECTIVE_TRAITS::contains);
        if (!hasAdjective && codes.contains("NORMAL_WEIGHT")) {
            // e.g. "Normal-weight boy" when no build/stature signal
        } else if (!hasAdjective && codes.isEmpty()) {
            codes.add("NORMAL_WEIGHT");
        }

        return List.copyOf(codes);
    }

    private static String buildPhrase(
            HospitalMessageResolver messages,
            String localeCode,
            List<String> traitCodes,
            String sex
    ) {
        List<String> adjectives = new ArrayList<>();
        for (String code : traitCodes) {
            if (ADJECTIVE_TRAITS.contains(code)) {
                adjectives.add(resolveTraitLabel(messages, localeCode, code).toLowerCase(Locale.ROOT));
            }
        }
        String sexWord = resolveSexLabel(messages, localeCode, sex).toLowerCase(Locale.ROOT);
        if (sexWord.isBlank()) {
            sexWord = resolveTraitLabel(messages, localeCode, "CHILD").toLowerCase(Locale.ROOT);
        }

        StringBuilder phrase = new StringBuilder();
        if (!adjectives.isEmpty()) {
            phrase.append(capitalize(adjectives.get(0)));
            for (int i = 1; i < adjectives.size(); i++) {
                phrase.append(' ').append(adjectives.get(i));
            }
            phrase.append(' ').append(sexWord);
        } else if (!sexWord.isBlank()) {
            phrase.append(capitalize(sexWord));
        } else {
            phrase.append(resolveTraitLabel(messages, localeCode, "CHILD"));
        }
        return phrase.toString().trim();
    }

    private static String resolveTraitLabel(HospitalMessageResolver messages, String localeCode, String code) {
        String key = "growth.characteristic." + code.toLowerCase(Locale.ROOT);
        return messages.get(key, localeCode);
    }

    private static String resolveSexLabel(HospitalMessageResolver messages, String localeCode, String sex) {
        if (sex == null || sex.isBlank()) {
            return "";
        }
        String normalized = sex.trim().toLowerCase(Locale.ROOT);
        if ("female".equals(normalized)) {
            return messages.get("growth.characteristic.girl", localeCode);
        }
        if ("male".equals(normalized)) {
            return messages.get("growth.characteristic.boy", localeCode);
        }
        return "";
    }

    private static String sexTraitCode(String sex) {
        if (sex == null) {
            return "";
        }
        String normalized = sex.trim().toLowerCase(Locale.ROOT);
        if ("female".equals(normalized)) {
            return "GIRL";
        }
        if ("male".equals(normalized)) {
            return "BOY";
        }
        return "";
    }

    private static Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private static String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (value.length() == 1) {
            return value.toUpperCase(Locale.ROOT);
        }
        return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1);
    }
}
