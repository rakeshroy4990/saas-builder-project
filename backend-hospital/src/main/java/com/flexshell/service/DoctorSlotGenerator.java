package com.flexshell.service;

import com.flexshell.doctorschedule.DoctorScheduleDay;
import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.doctorschedule.DoctorScheduleWindow;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class DoctorSlotGenerator {
    private static final DateTimeFormatter VALUE_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter LABEL_FMT = DateTimeFormatter.ofPattern("h:mm a", Locale.US);

    private DoctorSlotGenerator() {
    }

    public static boolean scheduleHasEnabledWorkingDay(DoctorScheduleEntity schedule) {
        if (schedule == null || schedule.getWeekly() == null || schedule.getWeekly().isEmpty()) {
            return false;
        }
        for (DoctorScheduleDay day : schedule.getWeekly().values()) {
            if (day != null && day.isEnabled() && day.getWindows() != null && !day.getWindows().isEmpty()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Slot value keys like {@code 10:00-10:15} in the hospital zone for the given calendar date.
     */
    public static List<String> generateSlotValues(LocalDate date, ZoneId zoneId, DoctorScheduleEntity schedule) {
        if (schedule == null || date == null || zoneId == null) {
            return List.of();
        }
        DayOfWeek dow = date.getDayOfWeek();
        String key = dayKey(dow);
        Map<String, DoctorScheduleDay> weekly = schedule.getWeekly();
        if (weekly == null) {
            return List.of();
        }
        DoctorScheduleDay day = weekly.get(key);
        if (day == null || !day.isEnabled() || day.getWindows() == null || day.getWindows().isEmpty()) {
            return List.of();
        }
        int slotMinutes = day.getSlotMinutes();
        if (slotMinutes != 15 && slotMinutes != 30) {
            return List.of();
        }
        List<DoctorScheduleWindow> sorted = new ArrayList<>(day.getWindows());
        sorted.sort(Comparator.comparing(w -> safeTime(w.getStart(), LocalTime.MIN)));

        Set<String> out = new LinkedHashSet<>();
        ZonedDateTime dayStart = date.atStartOfDay(zoneId);
        for (DoctorScheduleWindow w : sorted) {
            LocalTime ws = safeTime(w.getStart(), null);
            LocalTime we = safeTime(w.getEnd(), null);
            if (ws == null || we == null || !ws.isBefore(we)) {
                continue;
            }
            ZonedDateTime cursor = dayStart.with(ws);
            ZonedDateTime windowEnd = dayStart.with(we);
            while (cursor.isBefore(windowEnd)) {
                ZonedDateTime slotEnd = cursor.plusMinutes(slotMinutes);
                if (slotEnd.isAfter(windowEnd)) {
                    break;
                }
                String value = cursor.format(VALUE_FMT) + "-" + slotEnd.format(VALUE_FMT);
                out.add(value);
                cursor = slotEnd;
            }
        }
        return new ArrayList<>(out);
    }

    public static String formatLabel(String value) {
        if (value == null || !value.contains("-")) {
            return value == null ? "" : value;
        }
        int dash = value.indexOf('-');
        String a = value.substring(0, dash).trim();
        String b = value.substring(dash + 1).trim();
        try {
            LocalTime t1 = LocalTime.parse(a, VALUE_FMT);
            LocalTime t2 = LocalTime.parse(b, VALUE_FMT);
            return t1.format(LABEL_FMT) + " - " + t2.format(LABEL_FMT);
        } catch (Exception ex) {
            return value;
        }
    }

    private static LocalTime safeTime(String raw, LocalTime fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return LocalTime.parse(raw.trim());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private static String dayKey(DayOfWeek dow) {
        return switch (dow) {
            case MONDAY -> "MON";
            case TUESDAY -> "TUE";
            case WEDNESDAY -> "WED";
            case THURSDAY -> "THU";
            case FRIDAY -> "FRI";
            case SATURDAY -> "SAT";
            case SUNDAY -> "SUN";
        };
    }
}
