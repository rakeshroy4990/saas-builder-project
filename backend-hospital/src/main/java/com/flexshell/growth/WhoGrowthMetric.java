package com.flexshell.growth;

public enum WhoGrowthMetric {
    WFA("wfa"),
    LHFA("lhfa"),
    BFA("bfa"),
    HCFA("hcfa");

    private final String wireKey;

    WhoGrowthMetric(String wireKey) {
        this.wireKey = wireKey;
    }

    public String wireKey() {
        return wireKey;
    }

    public static WhoGrowthMetric fromWire(String raw) {
        String normalized = raw == null ? "" : raw.trim().toLowerCase();
        for (WhoGrowthMetric metric : values()) {
            if (metric.wireKey.equals(normalized)) {
                return metric;
            }
        }
        throw new IllegalArgumentException("WHO_METRIC_INVALID");
    }
}
