package com.flexshell.doctorschedule;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.mongodb.core.mapping.Field;

public class DoctorScheduleWindow {
    @Field("Start")
    @JsonProperty("Start")
    @JsonAlias({"start"})
    private String start = "";

    @Field("End")
    @JsonProperty("End")
    @JsonAlias({"end"})
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
