package com.flexshell.ai;

import com.flexshell.controller.dto.AiChatMessageDto;
import com.flexshell.controller.dto.AiChatRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SmartAiQuotaServiceTest {

    @Test
    void tokenBudgetIncludesMessageAndHistory() {
        String pad = "a".repeat(400);
        AiChatRequest request = new AiChatRequest(
                pad,
                null,
                List.of(new AiChatMessageDto("user", pad), new AiChatMessageDto("assistant", pad))
        );
        SmartAiQuotaService svc = new SmartAiQuotaService(15, 299, null);
        assertThrows(SmartAiQuotaExceededException.class, () -> svc.assertWithinTokenBudget(request));
    }

    @Test
    void dailyLimitUsesConfiguredCap() {
        SmartAiQuotaService svc = new SmartAiQuotaService(2, 50_000, null);
        svc.consumeDailyRequestOrThrow("u-daily");
        svc.consumeDailyRequestOrThrow("u-daily");
        assertThrows(SmartAiQuotaExceededException.class, () -> svc.consumeDailyRequestOrThrow("u-daily"));
    }

    @Test
    void estimateTokensForTextRoundsUpByCharBlock() {
        assertEquals(0, SmartAiQuotaService.estimateTokensForText(""));
        assertEquals(1, SmartAiQuotaService.estimateTokensForText("abcd"));
        assertEquals(2, SmartAiQuotaService.estimateTokensForText("abcde"));
    }
}
