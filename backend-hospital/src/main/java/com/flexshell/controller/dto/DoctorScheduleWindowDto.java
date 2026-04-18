package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DoctorScheduleWindowDto {
    @JsonProperty("Start")
    private String start = "";
    @JsonProperty("End")
    private String end = "";

    public String getStart() {
        return start;
    }

    public void setStart(String start) {
        this.start = start;
    }

    public String getEnd() {
        return end;
    }

    public void setEnd(String end) {
        this.end = end;
    }
}
