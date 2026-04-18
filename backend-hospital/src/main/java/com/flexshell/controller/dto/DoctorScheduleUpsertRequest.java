package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.LinkedHashMap;
import java.util.Map;

public class DoctorScheduleUpsertRequest {
    @JsonProperty("DoctorId")
    private String doctorId = "";
    @JsonProperty("Weekly")
    private Map<String, DoctorScheduleDayDto> weekly = new LinkedHashMap<>();

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public Map<String, DoctorScheduleDayDto> getWeekly() {
        return weekly;
    }

    public void setWeekly(Map<String, DoctorScheduleDayDto> weekly) {
        this.weekly = weekly == null ? new LinkedHashMap<>() : weekly;
    }
}
