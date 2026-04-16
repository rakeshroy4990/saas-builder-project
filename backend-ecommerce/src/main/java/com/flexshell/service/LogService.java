package com.flexshell.service;

import com.flexshell.logging.api.ClientLogBatchRequest;
import com.flexshell.logging.api.ClientLogEntryRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class LogService {
    private static final Logger LOG = LoggerFactory.getLogger(LogService.class);
    private static final String ROOT_APP_LOGGER = "com.flexshell";
    private final LoggingSystem loggingSystem;

    public LogService(LoggingSystem loggingSystem) {
        this.loggingSystem = loggingSystem;
    }

    public int ingestClientLogs(ClientLogBatchRequest request) {
        int accepted = 0;
        for (ClientLogEntryRequest entry : request.getEntries()) {
            String trace = entry.getTraceId() == null || entry.getTraceId().isBlank()
                    ? request.getTraceId()
                    : entry.getTraceId();
            try {
                if (trace != null && !trace.isBlank()) {
                    MDC.put("traceId", trace);
                }
                String msg = String.format(
                        Locale.ROOT,
                        "[UI][%s] %s context=%s",
                        entry.getTimestamp(),
                        entry.getMessage(),
                        entry.getContext());
                switch (entry.getLevel().toUpperCase(Locale.ROOT)) {
                    case "ERROR" -> LOG.error(msg);
                    case "WARN" -> LOG.warn(msg);
                    case "DEBUG" -> LOG.debug(msg);
                    default -> LOG.info(msg);
                }
                accepted++;
            } finally {
                MDC.remove("traceId");
            }
        }
        return accepted;
    }

    public String setServerLogLevel(String level) {
        LogLevel parsed = LogLevel.valueOf(level.toUpperCase(Locale.ROOT));
        loggingSystem.setLogLevel(ROOT_APP_LOGGER, parsed);
        return parsed.name();
    }
}
