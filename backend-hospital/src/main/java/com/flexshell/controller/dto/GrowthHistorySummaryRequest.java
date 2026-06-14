package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.UUID;

public class GrowthHistorySummaryRequest {

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("AgeMonthsAtRecording")
    private BigDecimal ageMonthsAtRecording;

    @JsonProperty("WeightKg")
    private BigDecimal weightKg;

    @JsonProperty("HeightCm")
    private BigDecimal heightCm;

    @JsonProperty("HeadCircumferenceCm")
    private BigDecimal headCircumferenceCm;

    @JsonProperty("WeightPercentile")
    private BigDecimal weightPercentile;

    @JsonProperty("HeightPercentile")
    private BigDecimal heightPercentile;

    @JsonProperty("BmiPercentile")
    private BigDecimal bmiPercentile;

    @JsonProperty("HcPercentile")
    private BigDecimal hcPercentile;

    @JsonProperty("ReplyLocale")
    private String replyLocale;

    @JsonProperty("Sex")
    private String sex;

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }

    public BigDecimal getAgeMonthsAtRecording() {
        return ageMonthsAtRecording;
    }

    public void setAgeMonthsAtRecording(BigDecimal ageMonthsAtRecording) {
        this.ageMonthsAtRecording = ageMonthsAtRecording;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(BigDecimal heightCm) {
        this.heightCm = heightCm;
    }

    public BigDecimal getHeadCircumferenceCm() {
        return headCircumferenceCm;
    }

    public void setHeadCircumferenceCm(BigDecimal headCircumferenceCm) {
        this.headCircumferenceCm = headCircumferenceCm;
    }

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

    public String getReplyLocale() {
        return replyLocale;
    }

    public void setReplyLocale(String replyLocale) {
        this.replyLocale = replyLocale;
    }

    public String getSex() {
        return sex;
    }

    public void setSex(String sex) {
        this.sex = sex;
    }
}
