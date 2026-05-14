package com.flexshell.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "perf")
public class PerfProperties {

    /**
     * When true, logs per-request latency to the {@code PERF} logger and propagates {@code traceId} in MDC.
     */
    private boolean enabled = false;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
