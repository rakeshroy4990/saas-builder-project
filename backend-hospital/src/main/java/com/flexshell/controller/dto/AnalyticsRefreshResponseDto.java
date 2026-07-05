package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AnalyticsRefreshResponseDto(
        @JsonProperty("DurationMs") long durationMs,
        @JsonProperty("TriggerType") String triggerType
) {
}
