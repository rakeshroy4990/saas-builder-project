package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class BookingDateAvailabilityResponse {
    @JsonProperty("UsesSchedule")
    private boolean usesSchedule;
    @JsonProperty("Days")
    private List<BookingDateAvailabilityDayDto> days = new ArrayList<>();

    public BookingDateAvailabilityResponse() {
    }

    public BookingDateAvailabilityResponse(boolean usesSchedule, List<BookingDateAvailabilityDayDto> days) {
        this.usesSchedule = usesSchedule;
        this.days = days == null ? new ArrayList<>() : days;
    }

    public boolean isUsesSchedule() {
        return usesSchedule;
    }

    public void setUsesSchedule(boolean usesSchedule) {
        this.usesSchedule = usesSchedule;
    }

    public List<BookingDateAvailabilityDayDto> getDays() {
        return days;
    }

    public void setDays(List<BookingDateAvailabilityDayDto> days) {
        this.days = days == null ? new ArrayList<>() : days;
    }
}
