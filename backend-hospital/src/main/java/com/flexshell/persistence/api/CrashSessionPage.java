package com.flexshell.persistence.api;

import com.flexshell.telemetry.SessionTelemetryEntity;

import java.util.Collections;
import java.util.List;

/** Paginated crash-related {@code session_telemetry} rows. */
public record CrashSessionPage(
        List<SessionTelemetryEntity> items,
        long totalElements,
        int page,
        int size
) {
    public static CrashSessionPage empty(int page, int size) {
        return new CrashSessionPage(Collections.emptyList(), 0, page, size);
    }
}
