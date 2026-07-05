package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.YearMonth;

public record NewVsReturningDto(
        @JsonProperty("Month") String month,
        @JsonProperty("NewPatients") long newPatients,
        @JsonProperty("ReturningPatients") long returningPatients
) {
    public static String formatMonth(YearMonth ym) {
        return ym == null ? "" : ym.toString();
    }
}
