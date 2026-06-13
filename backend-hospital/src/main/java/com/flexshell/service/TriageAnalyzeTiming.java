package com.flexshell.service;

import org.slf4j.Logger;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Step timings for triage analyze (blocking JSON and NDJSON stream).
 */
final class TriageAnalyzeTiming {

    private final long startMs = System.currentTimeMillis();
    private final AtomicLong readyMs = new AtomicLong(-1);
    private final AtomicLong firstRagLineMs = new AtomicLong(-1);
    private final AtomicLong firstStatusMs = new AtomicLong(-1);
    private final AtomicLong firstDeltaMs = new AtomicLong(-1);
    private final AtomicLong completeMs = new AtomicLong(-1);
    private final AtomicLong syncFallbackStartMs = new AtomicLong(-1);
    private final AtomicLong persistMs = new AtomicLong(-1);
    private final AtomicInteger lineCount = new AtomicInteger(0);
    private final AtomicBoolean usedSyncFallback = new AtomicBoolean(false);
    private String completionPath = "unknown";

    void markReady() {
        readyMs.compareAndSet(-1, elapsed());
    }

    void markFirstRagLine() {
        firstRagLineMs.compareAndSet(-1, elapsed());
    }

    void markFirstStatus() {
        firstStatusMs.compareAndSet(-1, elapsed());
    }

    void markFirstDelta() {
        firstDeltaMs.compareAndSet(-1, elapsed());
    }

    void markComplete(String path) {
        completionPath = path == null || path.isBlank() ? "unknown" : path.trim();
        completeMs.compareAndSet(-1, elapsed());
    }

    void markSyncFallbackStart() {
        usedSyncFallback.set(true);
        syncFallbackStartMs.compareAndSet(-1, elapsed());
    }

    void markPersist() {
        persistMs.compareAndSet(-1, elapsed());
    }

    void incrementLine() {
        lineCount.incrementAndGet();
    }

    int ragLineCount() {
        return lineCount.get();
    }

    long elapsed() {
        return System.currentTimeMillis() - startMs;
    }

    void logSummary(Logger log, String actorUserId, int symptomCount, String mode) {
        log.info(
                "triage_analyze_timing mode={} actorId={} symptomCount={} path={} totalMs={} readyMs={} "
                        + "firstRagLineMs={} firstStatusMs={} firstDeltaMs={} persistMs={} completeMs={} "
                        + "syncFallback={} syncFallbackStartMs={} lineCount={}",
                mode,
                actorUserId,
                symptomCount,
                completionPath,
                elapsed(),
                readyMs.get(),
                firstRagLineMs.get(),
                firstStatusMs.get(),
                firstDeltaMs.get(),
                persistMs.get(),
                completeMs.get(),
                usedSyncFallback.get(),
                syncFallbackStartMs.get(),
                lineCount.get()
        );
    }

    static void logStep(Logger log, String actorUserId, String step, long stepStartMs, String extra) {
        long stepMs = System.currentTimeMillis() - stepStartMs;
        if (extra == null || extra.isBlank()) {
            log.info("triage_analyze_step actorId={} step={} stepMs={}", actorUserId, step, stepMs);
        } else {
            log.info(
                    "triage_analyze_step actorId={} step={} stepMs={} {}",
                    actorUserId,
                    step,
                    stepMs,
                    extra
            );
        }
    }

    static String formatMs(long ms) {
        return ms < 0 ? "n/a" : String.format(Locale.ROOT, "%d", ms);
    }
}
