package com.flexshell.service;

import java.util.Collections;
import java.util.List;

/**
 * Default 15-minute booking grid when a doctor has no {@code doctorSchedule} document.
 * Values must match the frontend legacy master catalog.
 */
public final class LegacySlotCatalog {
    private static final List<String> VALUES = List.of(
            "10:00-10:15",
            "10:15-10:30",
            "10:30-10:45",
            "10:45-11:00",
            "11:00-11:15",
            "11:15-11:30",
            "11:30-11:45",
            "11:45-12:00",
            "12:00-12:15",
            "12:15-12:30",
            "12:30-12:45",
            "12:45-13:00"
    );

    private LegacySlotCatalog() {
    }

    public static List<String> slotValues() {
        return Collections.unmodifiableList(VALUES);
    }
}
