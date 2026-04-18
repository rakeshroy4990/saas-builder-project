package com.flexshell.service;

import com.flexshell.doctorschedule.DoctorScheduleDay;
import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.doctorschedule.DoctorScheduleWindow;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DoctorSlotGeneratorTest {

    @Test
    void generatesFifteenMinuteSlotsAcrossTwoWindows() {
        DoctorScheduleEntity entity = new DoctorScheduleEntity();
        Map<String, DoctorScheduleDay> weekly = new LinkedHashMap<>();
        DoctorScheduleDay mon = new DoctorScheduleDay();
        mon.setEnabled(true);
        mon.setSlotMinutes(15);
        DoctorScheduleWindow w1 = new DoctorScheduleWindow();
        w1.setStart("10:00");
        w1.setEnd("10:30");
        DoctorScheduleWindow w2 = new DoctorScheduleWindow();
        w2.setStart("14:00");
        w2.setEnd("14:30");
        mon.setWindows(List.of(w1, w2));
        weekly.put("MON", mon);
        entity.setWeekly(weekly);

        LocalDate monday = LocalDate.of(2026, 4, 13);
        List<String> slots = DoctorSlotGenerator.generateSlotValues(monday, ZoneId.of("UTC"), entity);
        assertEquals(List.of("10:00-10:15", "10:15-10:30", "14:00-14:15", "14:15-14:30"), slots);
    }

    @Test
    void thirtyMinuteSlots() {
        DoctorScheduleEntity entity = new DoctorScheduleEntity();
        DoctorScheduleDay mon = new DoctorScheduleDay();
        mon.setEnabled(true);
        mon.setSlotMinutes(30);
        DoctorScheduleWindow w = new DoctorScheduleWindow();
        w.setStart("09:00");
        w.setEnd("10:30");
        mon.setWindows(List.of(w));
        Map<String, DoctorScheduleDay> weekly = new LinkedHashMap<>();
        weekly.put("MON", mon);
        entity.setWeekly(weekly);

        LocalDate monday = LocalDate.of(2026, 4, 13);
        List<String> slots = DoctorSlotGenerator.generateSlotValues(monday, ZoneId.of("UTC"), entity);
        assertEquals(List.of("09:00-09:30", "09:30-10:00", "10:00-10:30"), slots);
    }

    @Test
    void disabledDayReturnsEmpty() {
        DoctorScheduleEntity entity = new DoctorScheduleEntity();
        DoctorScheduleDay mon = new DoctorScheduleDay();
        mon.setEnabled(false);
        mon.setSlotMinutes(15);
        mon.setWindows(List.of());
        Map<String, DoctorScheduleDay> weekly = new LinkedHashMap<>();
        weekly.put("MON", mon);
        entity.setWeekly(weekly);

        LocalDate monday = LocalDate.of(2026, 4, 13);
        assertTrue(DoctorSlotGenerator.generateSlotValues(monday, ZoneId.of("UTC"), entity).isEmpty());
    }
}
