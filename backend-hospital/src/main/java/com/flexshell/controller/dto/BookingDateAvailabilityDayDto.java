package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class BookingDateAvailabilityDayDto {
    @JsonProperty("Date")
    private String date = "";
    @JsonProperty("SlotCount")
    private int slotCount;

    public BookingDateAvailabilityDayDto() {
    }

    public BookingDateAvailabilityDayDto(String date, int slotCount) {
        this.date = date == null ? "" : date;
        this.slotCount = slotCount;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date == null ? "" : date;
    }

    public int getSlotCount() {
        return slotCount;
    }

    public void setSlotCount(int slotCount) {
        this.slotCount = slotCount;
    }
}
