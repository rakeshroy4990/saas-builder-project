package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public class GrowthLatestSummaryDto {

    @JsonProperty("WeightPercentile")
    private BigDecimal weightPercentile;

    @JsonProperty("HeightPercentile")
    private BigDecimal heightPercentile;

    @JsonProperty("BmiPercentile")
    private BigDecimal bmiPercentile;

    @JsonProperty("HcPercentile")
    private BigDecimal hcPercentile;

    @JsonProperty("InterpretationBand")
    private String interpretationBand;

    public BigDecimal getWeightPercentile() {
        return weightPercentile;
    }

    public void setWeightPercentile(BigDecimal weightPercentile) {
        this.weightPercentile = weightPercentile;
    }

    public BigDecimal getHeightPercentile() {
        return heightPercentile;
    }

    public void setHeightPercentile(BigDecimal heightPercentile) {
        this.heightPercentile = heightPercentile;
    }

    public BigDecimal getBmiPercentile() {
        return bmiPercentile;
    }

    public void setBmiPercentile(BigDecimal bmiPercentile) {
        this.bmiPercentile = bmiPercentile;
    }

    public BigDecimal getHcPercentile() {
        return hcPercentile;
    }

    public void setHcPercentile(BigDecimal hcPercentile) {
        this.hcPercentile = hcPercentile;
    }

    public String getInterpretationBand() {
        return interpretationBand;
    }

    public void setInterpretationBand(String interpretationBand) {
        this.interpretationBand = interpretationBand;
    }
}
