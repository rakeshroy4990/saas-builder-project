package com.flexshell.logging;

import org.slf4j.Logger;

/**
 * Logger wrapper helper with standard debug-level lifecycle logs.
 */
public class CommonLogger {
    private final Logger logger;

    public CommonLogger(Logger logger) {
        this.logger = logger;
    }

    public void methodEntry(String methodName, String details) {
        logger.debug("methodEntry method={} details={}", methodName, details);
    }

    public void methodExit(String methodName, String details) {
        logger.debug("methodExit method={} details={}", methodName, details);
    }

    public void serviceEntry(String service, String operation, String details) {
        logger.debug("serviceEntry service={} operation={} details={}", service, operation, details);
    }

    public void serviceExit(String service, String operation, String details) {
        logger.debug("serviceExit service={} operation={} details={}", service, operation, details);
    }
}
