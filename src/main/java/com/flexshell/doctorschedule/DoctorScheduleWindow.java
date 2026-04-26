package com.flexshell.doctorschedule;

import org.springframework.data.mongodb.core.mapping.Field;

public class DoctorScheduleWindow {
    @Field("Start")
    private String start = "";

    @Field("End")
    private String end = "";

    public String getStart() {
        return start;
    }

    public void setStart(String start) {
        this.start = start == null ? "" : start.trim();
    }

    public String getEnd() {
        return end;
    }

    public void setEnd(String end) {
        this.end = end == null ? "" : end.trim();
    }
}
