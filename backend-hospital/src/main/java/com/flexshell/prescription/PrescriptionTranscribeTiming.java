package com.flexshell.prescription;

import org.slf4j.Logger;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Per-request step timer for {@code /api/hospital/education/prescription-transcribe}.
 * Logs a ranked breakdown at INFO when closed (no clinical text).
 */
public final class PrescriptionTranscribeTiming implements AutoCloseable {

    private static final ThreadLocal<PrescriptionTranscribeTiming> CURRENT = new ThreadLocal<>();

    private final long startedNanos = System.nanoTime();
    private final Map<String, Long> stepMillis = new LinkedHashMap<>();
    private String mime = "";
    private long fileBytes = -1;
    private String route = "";

    private PrescriptionTranscribeTiming() {
    }

    public static PrescriptionTranscribeTiming start() {
        PrescriptionTranscribeTiming timing = new PrescriptionTranscribeTiming();
        CURRENT.set(timing);
        return timing;
    }

    public static PrescriptionTranscribeTiming currentOrNull() {
        return CURRENT.get();
    }

    public void context(String mimeType, long bytes, String routeLabel) {
        this.mime = Objects.toString(mimeType, "").trim();
        this.fileBytes = bytes;
        this.route = Objects.toString(routeLabel, "").trim();
    }

    public void record(String step, Runnable work) {
        record(step, () -> {
            work.run();
            return null;
        });
    }

    public <T> T record(String step, Supplier<T> work) {
        long stepStart = System.nanoTime();
        try {
            return work.get();
        } finally {
            long elapsedMs = Math.max(0L, (System.nanoTime() - stepStart) / 1_000_000L);
            stepMillis.merge(step, elapsedMs, Long::sum);
        }
    }

    public long totalMillis() {
        return Math.max(0L, (System.nanoTime() - startedNanos) / 1_000_000L);
    }

    public String topStepSummary() {
        return stepMillis.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(3)
                .map(e -> e.getKey() + "=" + e.getValue() + "ms")
                .collect(Collectors.joining(", "));
    }

    /** Server-Timing header value for browser devtools (no PII). */
    public String toServerTimingHeader() {
        List<Map.Entry<String, Long>> ranked = new ArrayList<>(stepMillis.entrySet());
        ranked.sort(Map.Entry.comparingByValue(Comparator.reverseOrder()));
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, Long> entry : ranked) {
            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append(sanitizeServerTimingName(entry.getKey()))
                    .append(";dur=")
                    .append(entry.getValue());
        }
        long accounted = stepMillis.values().stream().mapToLong(Long::longValue).sum();
        long overhead = Math.max(0L, totalMillis() - accounted);
        if (overhead > 0) {
            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append("other;dur=").append(overhead);
        }
        return sb.toString();
    }

    public void logSummary(Logger log) {
        long totalMs = totalMillis();
        String ranked = stepMillis.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> e.getKey() + "=" + e.getValue() + "ms")
                .collect(Collectors.joining(", "));
        long accountedMs = stepMillis.values().stream().mapToLong(Long::longValue).sum();
        long unaccountedMs = Math.max(0L, totalMs - accountedMs);
        log.info(
                "education_prescription_transcribe_timing totalMs={} route={} mime={} fileBytes={} unaccountedMs={} steps=[{}]",
                totalMs,
                route.isBlank() ? "unknown" : route,
                mime.isBlank() ? "unknown" : mime,
                fileBytes < 0 ? "unknown" : fileBytes,
                unaccountedMs,
                ranked.isBlank() ? "(none)" : ranked
        );
        if (!stepMillis.isEmpty()) {
            String slowest = stepMillis.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(e -> e.getKey() + " (" + e.getValue() + "ms, "
                            + String.format(Locale.ROOT, "%.1f", 100.0 * e.getValue() / Math.max(1, totalMs)) + "% of total)")
                    .orElse("unknown");
            log.info("education_prescription_transcribe_timing_slowest step={}", slowest);
        }
    }

    @Override
    public void close() {
        CURRENT.remove();
    }

    private static String sanitizeServerTimingName(String step) {
        return step.replaceAll("[^a-zA-Z0-9_-]", "_");
    }
}
