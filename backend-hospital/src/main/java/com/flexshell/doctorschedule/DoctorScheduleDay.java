package com.flexshell.doctorschedule;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.List;

public class DoctorScheduleDay {
    @Field("Enabled")
    @JsonProperty("Enabled")
    @JsonAlias({"enabled"})
    private boolean enabled;

    @Field("SlotMinutes")
    @JsonProperty("SlotMinutes")
    @JsonAlias({"slotMinutes"})
    private int slotMinutes = 15;

    @Field("Windows")
    @JsonProperty("Windows")
    @JsonAlias({"windows"})
    private List<DoctorScheduleWindow> windows = new ArrayList<>();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getSlotMinutes() {
        return slotMinutes;
    }

    public void setSlotMinutes(int slotMinutes) {
        this.slotMinutes = slotMinutes;
    }

    public List<DoctorScheduleWindow> getWindows() {
        return windows;
    }

    public void setWindows(List<DoctorScheduleWindow> windows) {
        this.windows = windows == null ? new ArrayList<>() : windows;
    }
}
