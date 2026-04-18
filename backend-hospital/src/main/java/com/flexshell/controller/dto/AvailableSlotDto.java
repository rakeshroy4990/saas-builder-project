package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AvailableSlotDto {
    @JsonProperty("Value")
    private String value = "";
    @JsonProperty("Label")
    private String label = "";

    public AvailableSlotDto() {
    }

    public AvailableSlotDto(String value, String label) {
        this.value = value;
        this.label = label;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
