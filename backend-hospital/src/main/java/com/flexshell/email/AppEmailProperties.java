package com.flexshell.email;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Generic outbound email integration (e.g. internal Node {@code email-notify} server, Resend bridge).
 */
@ConfigurationProperties(prefix = "app.email")
public class AppEmailProperties {

    /**
     * When true, features that delegate to the internal email server may run (e.g. appointment-created).
     */
    private boolean enabled;

    /**
     * Base URL of the internal email HTTP service (e.g. {@code http://localhost:8787}).
     */
    private String internalBaseUrl = "";

    /**
     * Public app / portal base URL used in email links (e.g. hospital UI).
     */
    private String portalBaseUrl = "http://localhost:5174";

    /**
     * Optional shared secret for server-to-server calls; must match {@code EMAIL_INTERNAL_SECRET} on the email service.
     */
    private String internalSecret = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getInternalBaseUrl() {
        return internalBaseUrl;
    }

    public void setInternalBaseUrl(String internalBaseUrl) {
        this.internalBaseUrl = internalBaseUrl;
    }

    public String getPortalBaseUrl() {
        return portalBaseUrl;
    }

    public void setPortalBaseUrl(String portalBaseUrl) {
        this.portalBaseUrl = portalBaseUrl;
    }

    public String getInternalSecret() {
        return internalSecret;
    }

    public void setInternalSecret(String internalSecret) {
        this.internalSecret = internalSecret;
    }
}
