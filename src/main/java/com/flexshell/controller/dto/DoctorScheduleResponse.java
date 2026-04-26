package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.LinkedHashMap;
import java.util.Map;

public class DoctorScheduleResponse {
    @JsonProperty("DoctorId")
    private String doctorId = "";
    @JsonProperty("Weekly")
    private Map<String, DoctorScheduleDayDto> weekly = new LinkedHashMap<>();
    @JsonProperty("UpdatedAt")
    private String updatedAt;
    @JsonProperty("UpdatedBy")
    private String updatedBy = "";

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

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
