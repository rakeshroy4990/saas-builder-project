package com.flexshell.growth;

import com.flexshell.controller.dto.GrowthCharacteristicsDto;
import com.flexshell.i18n.HospitalMessageResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticMessageSource;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

class GrowthCharacteristicSupportTest {

    private HospitalMessageResolver messages;

    @BeforeEach
    void setUp() {
        StaticMessageSource source = new StaticMessageSource();
        for (Map.Entry<String, String> entry : Map.ofEntries(
                Map.entry("growth.characteristic.lean", "Lean"),
                Map.entry("growth.characteristic.tall", "Tall"),
                Map.entry("growth.characteristic.normal_weight", "Normal weight"),
                Map.entry("growth.characteristic.boy", "Boy"),
                Map.entry("growth.characteristic.girl", "Girl"),
                Map.entry("growth.characteristic.child", "Child")
        ).entrySet()) {
            source.addMessage(entry.getKey(), Locale.ENGLISH, entry.getValue());
        }
        messages = new HospitalMessageResolver(source);
    }

    @Test
    void derive_tallLeanBoy_matchesExpectedPhrase() {
        GrowthCharacteristicsDto dto = GrowthCharacteristicSupport.derive(
                messages,
                "en",
                "male",
                BigDecimal.valueOf(39.0),
                BigDecimal.valueOf(97.0),
                BigDecimal.valueOf(1.0),
                null
        );
        assertTrue(dto.getPhrase().toLowerCase(Locale.ROOT).contains("lean"));
        assertTrue(dto.getPhrase().toLowerCase(Locale.ROOT).contains("tall"));
        assertTrue(dto.getPhrase().toLowerCase(Locale.ROOT).contains("boy"));
        assertTrue(dto.getLabels().contains("Normal weight"));
    }
}
