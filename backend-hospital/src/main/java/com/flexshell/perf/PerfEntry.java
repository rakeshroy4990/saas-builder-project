package com.flexshell.perf;

public record PerfEntry(String traceId, String path, String method, int statusCode, long durationMs) {}
