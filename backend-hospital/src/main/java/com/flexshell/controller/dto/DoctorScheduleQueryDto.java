package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DoctorScheduleQueryDto {
    @JsonProperty("DoctorId")
    private String doctorId;

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }
}
