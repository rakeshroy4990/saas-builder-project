package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DoctorPrescriptionMedicationDto {

    @JsonProperty("Name")
    private String name;

    @JsonProperty("DoseMg")
    private Double doseMg;

    @JsonProperty("FrequencyPerDay")
    private Integer frequencyPerDay;

    @JsonProperty("Route")
    private String route = "oral";

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getDoseMg() {
        return doseMg;
    }

    public void setDoseMg(Double doseMg) {
        this.doseMg = doseMg;
    }

    public Integer getFrequencyPerDay() {
        return frequencyPerDay;
    }

    public void setFrequencyPerDay(Integer frequencyPerDay) {
        this.frequencyPerDay = frequencyPerDay;
    }

    public String getRoute() {
        return route;
    }

    public void setRoute(String route) {
        this.route = route;
    }
}
