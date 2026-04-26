package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class AvailableSlotsResponse {
    @JsonProperty("UsesSchedule")
    private boolean usesSchedule;
    @JsonProperty("Slots")
    private List<AvailableSlotDto> slots = new ArrayList<>();

    public AvailableSlotsResponse() {
    }

    public AvailableSlotsResponse(boolean usesSchedule, List<AvailableSlotDto> slots) {
        this.usesSchedule = usesSchedule;
        this.slots = slots == null ? new ArrayList<>() : slots;
    }

    public boolean isUsesSchedule() {
        return usesSchedule;
    }

    public void setUsesSchedule(boolean usesSchedule) {
        this.usesSchedule = usesSchedule;
    }

    public List<AvailableSlotDto> getSlots() {
        return slots;
    }

    public void setSlots(List<AvailableSlotDto> slots) {
        this.slots = slots == null ? new ArrayList<>() : slots;
    }
}
