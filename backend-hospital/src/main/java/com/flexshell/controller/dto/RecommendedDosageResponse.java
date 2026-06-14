package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class RecommendedDosageResponse {

    @JsonProperty("ExtractedName")
    private String extractedName;

    @JsonProperty("GenericName")
    private String genericName;

    @JsonProperty("Status")
    private String status;

    @JsonProperty("ChildWeightKg")
    private BigDecimal childWeightKg;

    @JsonProperty("ChildAgeMonths")
    private BigDecimal childAgeMonths;

    @JsonProperty("Route")
    private String route;

    @JsonProperty("DosePerKgMg")
    private BigDecimal dosePerKgMg;

    @JsonProperty("ExpectedDoseRangeMg")
    private List<BigDecimal> expectedDoseRangeMg = new ArrayList<>();

    @JsonProperty("MaxSingleDoseMg")
    private BigDecimal maxSingleDoseMg;

    @JsonProperty("MaxDailyDoseMg")
    private BigDecimal maxDailyDoseMg;

    @JsonProperty("FrequencyPerDayMin")
    private Integer frequencyPerDayMin;

    @JsonProperty("FrequencyPerDayMax")
    private Integer frequencyPerDayMax;

    @JsonProperty("Source")
    private String source;

    @JsonProperty("Message")
    private String message;

    public String getExtractedName() {
        return extractedName;
    }

    public void setExtractedName(String extractedName) {
        this.extractedName = extractedName;
    }

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

    public BigDecimal getChildWeightKg() {
        return childWeightKg;
    }

    public void setChildWeightKg(BigDecimal childWeightKg) {
        this.childWeightKg = childWeightKg;
    }

    public BigDecimal getChildAgeMonths() {
        return childAgeMonths;
    }

    public void setChildAgeMonths(BigDecimal childAgeMonths) {
        this.childAgeMonths = childAgeMonths;
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public BigDecimal getDosePerKgMg() {
        return dosePerKgMg;
    }

    public void setDosePerKgMg(BigDecimal dosePerKgMg) {
        this.dosePerKgMg = dosePerKgMg;
    }

    public List<BigDecimal> getExpectedDoseRangeMg() {
        return expectedDoseRangeMg;
    }

    public void setExpectedDoseRangeMg(List<BigDecimal> expectedDoseRangeMg) {
        this.expectedDoseRangeMg = expectedDoseRangeMg == null ? new ArrayList<>() : expectedDoseRangeMg;
    }

    public BigDecimal getMaxSingleDoseMg() {
        return maxSingleDoseMg;
    }

    public void setMaxSingleDoseMg(BigDecimal maxSingleDoseMg) {
        this.maxSingleDoseMg = maxSingleDoseMg;
    }

    public BigDecimal getMaxDailyDoseMg() {
        return maxDailyDoseMg;
    }

    public void setMaxDailyDoseMg(BigDecimal maxDailyDoseMg) {
        this.maxDailyDoseMg = maxDailyDoseMg;
    }

    public Integer getFrequencyPerDayMin() {
        return frequencyPerDayMin;
    }

    public void setFrequencyPerDayMin(Integer frequencyPerDayMin) {
        this.frequencyPerDayMin = frequencyPerDayMin;
    }

    public Integer getFrequencyPerDayMax() {
        return frequencyPerDayMax;
    }

    public void setFrequencyPerDayMax(Integer frequencyPerDayMax) {
        this.frequencyPerDayMax = frequencyPerDayMax;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
