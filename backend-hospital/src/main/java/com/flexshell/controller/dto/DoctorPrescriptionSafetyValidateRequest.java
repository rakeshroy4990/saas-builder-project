package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class DoctorPrescriptionSafetyValidateRequest {

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("ChildAgeMonths")
    private Double childAgeMonths;

    @JsonProperty("ChildWeightKg")
    private Double childWeightKg;

    @JsonProperty("WeightSource")
    private String weightSource;

    @JsonProperty("TemperatureF")
    private Double temperatureF;

    @JsonProperty("Medications")
    private List<DoctorPrescriptionMedicationDto> medications = new ArrayList<>();

    /** Editable doctor-facing summary; medicines are parsed from the Medicines section when present. */
    @JsonProperty("PrescriptionSummary")
    private String prescriptionSummary;

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

    public String getWeightSource() {
        return weightSource;
    }

    public void setWeightSource(String weightSource) {
        this.weightSource = weightSource;
    }

    public Double getTemperatureF() {
        return temperatureF;
    }

    public void setTemperatureF(Double temperatureF) {
        this.temperatureF = temperatureF;
    }

    public List<DoctorPrescriptionMedicationDto> getMedications() {
        return medications;
    }

    public void setMedications(List<DoctorPrescriptionMedicationDto> medications) {
        this.medications = medications == null ? new ArrayList<>() : medications;
    }

    public String getPrescriptionSummary() {
        return prescriptionSummary;
    }

    public void setPrescriptionSummary(String prescriptionSummary) {
        this.prescriptionSummary = prescriptionSummary;
    }
}
