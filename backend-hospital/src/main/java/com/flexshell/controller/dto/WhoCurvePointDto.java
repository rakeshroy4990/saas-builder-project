package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class WhoCurvePointDto {

    @JsonProperty("AgeMonths")
    private double ageMonths;

    @JsonProperty("Value")
    private double value;

    public WhoCurvePointDto() {
    }

    public WhoCurvePointDto(double ageMonths, double value) {
        this.ageMonths = ageMonths;
        this.value = value;
    }

    public double getAgeMonths() {
        return ageMonths;
    }

    public void setAgeMonths(double ageMonths) {
        this.ageMonths = ageMonths;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
    }
}
