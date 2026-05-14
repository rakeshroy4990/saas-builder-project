package com.flexshell.perf;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.config.PerfProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PerfLoggingFilter extends OncePerRequestFilter {

    private static final Logger PERF_LOG = LoggerFactory.getLogger("PERF");

    private final PerfProperties perfProperties;
    private final ObjectMapper objectMapper;

    public PerfLoggingFilter(PerfProperties perfProperties, ObjectMapper objectMapper) {
        this.perfProperties = perfProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!perfProperties.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        String traceId = UUID.randomUUID().toString();
        MDC.put("traceId", traceId);
        long t0 = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = Math.max(0L, (System.nanoTime() - t0) / 1_000_000L);
            PerfEntry entry = new PerfEntry(
                    traceId,
                    request.getRequestURI(),
                    request.getMethod(),
                    response.getStatus(),
                    durationMs);
            logPerf(entry);
            MDC.clear();
        }
    }

    private void logPerf(PerfEntry entry) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("layer", "spring-boot");
        payload.put(
                "operation",
                "HTTP_" + (entry.method() == null ? "UNKNOWN" : entry.method()) + " " + entry.path());
        payload.put("durationMs", entry.durationMs());
        payload.put("statusCode", entry.statusCode());
        payload.put("traceId", entry.traceId());
        payload.put("timestamp", Instant.now().toString());
        try {
            PERF_LOG.info(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            PERF_LOG.info(
                    "traceId={} method={} path={} statusCode={} durationMs={}",
                    entry.traceId(),
                    entry.method(),
                    entry.path(),
                    entry.statusCode(),
                    entry.durationMs());
        }
    }
}
