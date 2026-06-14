package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public class RecommendedDosageRequest {

    @JsonProperty("DrugName")
    private String drugName;

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("ChildAgeMonths")
    private Double childAgeMonths;

    @JsonProperty("ChildWeightKg")
    private Double childWeightKg;

    @JsonProperty("Route")
    private String route = "oral";

    public String getDrugName() {
        return drugName;
    }

    public void setDrugName(String drugName) {
        this.drugName = drugName;
    }

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }

    public Double getChildAgeMonths() {
        return childAgeMonths;
    }

    public void setChildAgeMonths(Double childAgeMonths) {
        this.childAgeMonths = childAgeMonths;
    }

    public Double getChildWeightKg() {
        return childWeightKg;
    }

    public void setChildWeightKg(Double childWeightKg) {
        this.childWeightKg = childWeightKg;
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }
}
