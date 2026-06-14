package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class MidParentalHeightDto {

    @JsonProperty("Complete")
    private boolean complete;

    @JsonProperty("MotherHeightCm")
    private BigDecimal motherHeightCm;

    @JsonProperty("FatherHeightCm")
    private BigDecimal fatherHeightCm;

    @JsonProperty("TargetAdultHeightCm")
    private BigDecimal targetAdultHeightCm;

    @JsonProperty("TargetRangeLowCm")
    private BigDecimal targetRangeLowCm;

    @JsonProperty("TargetRangeHighCm")
    private BigDecimal targetRangeHighCm;

    @JsonProperty("ExpectedHeightAtAgeCm")
    private BigDecimal expectedHeightAtAgeCm;

    @JsonProperty("ExpectedHeightAgeMonths")
    private BigDecimal expectedHeightAgeMonths;

    @JsonProperty("GeneticTargetCurve")
    private List<WhoCurvePointDto> geneticTargetCurve = new ArrayList<>();

    public boolean isComplete() {
        return complete;
    }

    public void setComplete(boolean complete) {
        this.complete = complete;
    }

    public BigDecimal getMotherHeightCm() {
        return motherHeightCm;
    }

    public void setMotherHeightCm(BigDecimal motherHeightCm) {
        this.motherHeightCm = motherHeightCm;
    }

    public BigDecimal getFatherHeightCm() {
        return fatherHeightCm;
    }

    public void setFatherHeightCm(BigDecimal fatherHeightCm) {
        this.fatherHeightCm = fatherHeightCm;
    }

    public BigDecimal getTargetAdultHeightCm() {
        return targetAdultHeightCm;
    }

    public void setTargetAdultHeightCm(BigDecimal targetAdultHeightCm) {
        this.targetAdultHeightCm = targetAdultHeightCm;
    }

    public BigDecimal getTargetRangeLowCm() {
        return targetRangeLowCm;
    }

    public void setTargetRangeLowCm(BigDecimal targetRangeLowCm) {
        this.targetRangeLowCm = targetRangeLowCm;
    }

    public BigDecimal getTargetRangeHighCm() {
        return targetRangeHighCm;
    }

    public void setTargetRangeHighCm(BigDecimal targetRangeHighCm) {
        this.targetRangeHighCm = targetRangeHighCm;
    }

    public BigDecimal getExpectedHeightAtAgeCm() {
        return expectedHeightAtAgeCm;
    }

    public void setExpectedHeightAtAgeCm(BigDecimal expectedHeightAtAgeCm) {
        this.expectedHeightAtAgeCm = expectedHeightAtAgeCm;
    }

    public BigDecimal getExpectedHeightAgeMonths() {
        return expectedHeightAgeMonths;
    }

    public void setExpectedHeightAgeMonths(BigDecimal expectedHeightAgeMonths) {
        this.expectedHeightAgeMonths = expectedHeightAgeMonths;
    }

    public List<WhoCurvePointDto> getGeneticTargetCurve() {
        return geneticTargetCurve;
    }

    public void setGeneticTargetCurve(List<WhoCurvePointDto> geneticTargetCurve) {
        this.geneticTargetCurve = geneticTargetCurve == null ? new ArrayList<>() : geneticTargetCurve;
    }
}
