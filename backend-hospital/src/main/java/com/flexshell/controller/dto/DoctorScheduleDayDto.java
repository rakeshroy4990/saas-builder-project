package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class DoctorScheduleDayDto {
    @JsonProperty("Enabled")
    private boolean enabled;
    @JsonProperty("SlotMinutes")
    private int slotMinutes = 15;
    @JsonProperty("Windows")
    private List<DoctorScheduleWindowDto> windows = new ArrayList<>();

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

    public List<DoctorScheduleWindowDto> getWindows() {
        return windows;
    }

    public void setWindows(List<DoctorScheduleWindowDto> windows) {
        this.windows = windows == null ? new ArrayList<>() : windows;
    }
}
