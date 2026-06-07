package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class AppointmentBookingFormContextResponse {
    @JsonProperty("Doctors")
    private List<DoctorOptionResponse> doctors = new ArrayList<>();
    @JsonProperty("DateAvailability")
    private BookingDateAvailabilityResponse dateAvailability;

    public List<DoctorOptionResponse> getDoctors() {
        return doctors;
    }

    public void setDoctors(List<DoctorOptionResponse> doctors) {
        this.doctors = doctors == null ? new ArrayList<>() : doctors;
    }

    public BookingDateAvailabilityResponse getDateAvailability() {
        return dateAvailability;
    }

    public void setDateAvailability(BookingDateAvailabilityResponse dateAvailability) {
        this.dateAvailability = dateAvailability;
    }
}
