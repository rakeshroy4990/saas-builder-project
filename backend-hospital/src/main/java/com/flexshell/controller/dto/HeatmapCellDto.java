package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record HeatmapCellDto(
        @JsonProperty("DoctorId") String doctorId,
        @JsonProperty("DayOfWeek") int dayOfWeek,
        @JsonProperty("HourSlot") int hourSlot,
        @JsonProperty("TotalBooked") long totalBooked,
        @JsonProperty("TotalCompleted") long totalCompleted,
        @JsonProperty("TotalNoShow") long totalNoShow,
        @JsonProperty("NoShowRatePct") BigDecimal noShowRatePct
) {
}
