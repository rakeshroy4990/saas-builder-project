package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class PrescriptionInteractionFindingDto {

    @JsonProperty("DrugA")
    private String drugA;

    @JsonProperty("DrugB")
    private String drugB;

    @JsonProperty("Severity")
    private String severity;

    @JsonProperty("Mechanism")
    private String mechanism;

    @JsonProperty("ClinicalEffect")
    private String clinicalEffect;

    @JsonProperty("Management")
    private String management;

    @JsonProperty("Source")
    private String source;

    @JsonProperty("DrugsFrom")
    private String drugsFrom;

    public String getDrugA() {
        return drugA;
    }

    public void setDrugA(String drugA) {
        this.drugA = drugA;
    }

    public String getDrugB() {
        return drugB;
    }

    public void setDrugB(String drugB) {
        this.drugB = drugB;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getMechanism() {
        return mechanism;
    }

    public void setMechanism(String mechanism) {
        this.mechanism = mechanism;
    }

    public String getClinicalEffect() {
        return clinicalEffect;
    }

    public void setClinicalEffect(String clinicalEffect) {
        this.clinicalEffect = clinicalEffect;
    }

    public String getManagement() {
        return management;
    }

    public void setManagement(String management) {
        this.management = management;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDrugsFrom() {
        return drugsFrom;
    }

    public void setDrugsFrom(String drugsFrom) {
        this.drugsFrom = drugsFrom;
    }
}
