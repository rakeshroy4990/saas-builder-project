package com.flexshell.doctorschedule;

import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.List;

public class DoctorScheduleDay {
    @Field("Enabled")
    private boolean enabled;

    @Field("SlotMinutes")
    private int slotMinutes = 15;

    @Field("Windows")
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
