package com.flexshell.video;

import com.flexshell.appointment.AppointmentEntity;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.Objects;

/**
 * Parses {@link AppointmentEntity#getPreferredDate()} and {@code PreferredTimeSlot} ({@code HH:mm-HH:mm})
 * into a wall-clock window in the hospital time zone.
 */
public final class AppointmentCallSlotParser {

    private AppointmentCallSlotParser() {
    }

    public record SlotWindow(ZonedDateTime start, ZonedDateTime end) {
    }

    /**
     * @return null if date or slot cannot be parsed
     */
    public static SlotWindow parseWindow(AppointmentEntity entity, ZoneId zoneId) {
        if (entity == null || zoneId == null) {
            return null;
        }
        LocalDate date = parseIsoLocalDate(entity.getPreferredDate());
        String slot = Objects.toString(entity.getPreferredTimeSlot(), "").trim();
        if (date == null || slot.isBlank()) {
            return null;
        }
        int dash = slot.indexOf('-');
        if (dash <= 0 || dash >= slot.length() - 1) {
            return null;
        }
        String a = slot.substring(0, dash).trim();
        String b = slot.substring(dash + 1).trim();
        try {
            LocalTime t0 = LocalTime.parse(a);
            LocalTime t1 = LocalTime.parse(b);
            if (!t0.isBefore(t1)) {
                return null;
            }
            ZonedDateTime start = date.atTime(t0).atZone(zoneId);
            ZonedDateTime end = date.atTime(t1).atZone(zoneId);
            return new SlotWindow(start, end);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static LocalDate parseIsoLocalDate(String raw) {
        String d = Objects.toString(raw, "").trim();
        if (d.length() >= 10) {
            d = d.substring(0, 10);
        }
        if (d.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(d);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }
}
