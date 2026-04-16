package com.flexshell.compliance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class PhiRetentionPolicy {
    private final long retentionDays;

    public PhiRetentionPolicy(@Value("${app.phi.retention-days:30}") long retentionDays) {
        this.retentionDays = Math.max(1, retentionDays);
    }

    public Instant expiresAtFromNow() {
        return Instant.now().plus(retentionDays, ChronoUnit.DAYS);
    }

    public long getRetentionDays() {
        return retentionDays;
    }
}

