package com.flexshell.analytics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AnalyticsMatviewRefreshService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsMatviewRefreshService.class);

    private final AnalyticsRepository analyticsRepository;

    @Value("${app.analytics.matview-refresh-timeout-seconds:120}")
    private long refreshTimeoutSeconds;

    public AnalyticsMatviewRefreshService(AnalyticsRepository analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    /** 02:00 IST = 20:30 UTC (Spring cron: second minute hour day month weekday) */
    @Scheduled(cron = "${app.analytics.matview-refresh-cron:0 30 20 * * *}", zone = "UTC")
    public void scheduledRefresh() {
        try {
            refresh("scheduled", null);
        } catch (Exception ex) {
            log.warn("analytics_matview_scheduled_refresh_failed message={}", ex.getMessage());
        }
    }

    public long refresh(String triggerType, String triggeredBy) {
        long started = System.currentTimeMillis();
        analyticsRepository.refreshMaterializedViews();
        long durationMs = System.currentTimeMillis() - started;
        analyticsRepository.insertRefreshLog(triggeredBy, triggerType, durationMs);
        log.info("analytics_matview_refreshed triggerType={} durationMs={}", triggerType, durationMs);
        return durationMs;
    }
}
