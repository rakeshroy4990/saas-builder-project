package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

public class PrescriptionDosageFindingDto {

    @JsonProperty("GenericName")
    private String genericName;

    @JsonProperty("Status")
    private String status;

    @JsonProperty("PrescribedDoseMg")
    private BigDecimal prescribedDoseMg;

    @JsonProperty("ExpectedDoseRangeMg")
    private List<BigDecimal> expectedDoseRangeMg;

    @JsonProperty("PrescribedDailyTotalMg")
    private BigDecimal prescribedDailyTotalMg;

    @JsonProperty("MaxSafeDailyMg")
    private BigDecimal maxSafeDailyMg;

    @JsonProperty("AgeAppropriate")
    private Boolean ageAppropriate;

    @JsonProperty("Message")
    private String message;

    public String getGenericName() {
        return genericName;
    }

    public void setGenericName(String genericName) {
        this.genericName = genericName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getPrescribedDoseMg() {
        return prescribedDoseMg;
    }

    public void setPrescribedDoseMg(BigDecimal prescribedDoseMg) {
        this.prescribedDoseMg = prescribedDoseMg;
    }

    public List<BigDecimal> getExpectedDoseRangeMg() {
        return expectedDoseRangeMg;
    }

    public void setExpectedDoseRangeMg(List<BigDecimal> expectedDoseRangeMg) {
        this.expectedDoseRangeMg = expectedDoseRangeMg;
    }

    public BigDecimal getPrescribedDailyTotalMg() {
        return prescribedDailyTotalMg;
    }

    public void setPrescribedDailyTotalMg(BigDecimal prescribedDailyTotalMg) {
        this.prescribedDailyTotalMg = prescribedDailyTotalMg;
    }

    public BigDecimal getMaxSafeDailyMg() {
        return maxSafeDailyMg;
    }

    public void setMaxSafeDailyMg(BigDecimal maxSafeDailyMg) {
        this.maxSafeDailyMg = maxSafeDailyMg;
    }

    public Boolean getAgeAppropriate() {
        return ageAppropriate;
    }

    public void setAgeAppropriate(Boolean ageAppropriate) {
        this.ageAppropriate = ageAppropriate;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
