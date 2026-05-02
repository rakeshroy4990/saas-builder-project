package com.flexshell.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Adds HSTS, CSP (optional), and related headers when serving over HTTPS (see {@code app.security.hsts.enabled}).
 */
@Component
@Order(1)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private final boolean hstsEnabled;
    private final long hstsMaxAgeSeconds;
    private final String contentSecurityPolicy;

    public SecurityHeadersFilter(
            @Value("${app.security.hsts.enabled:false}") boolean hstsEnabled,
            @Value("${app.security.hsts.max-age-seconds:31536000}") long hstsMaxAgeSeconds,
            @Value("${app.security.csp.policy:}") String contentSecurityPolicy) {
        this.hstsEnabled = hstsEnabled;
        this.hstsMaxAgeSeconds = Math.max(0L, hstsMaxAgeSeconds);
        this.contentSecurityPolicy = contentSecurityPolicy == null ? "" : contentSecurityPolicy.trim();
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(self), microphone=(self)");
        if (!contentSecurityPolicy.isEmpty()) {
            response.setHeader("Content-Security-Policy", contentSecurityPolicy);
        }
        if (hstsEnabled && hstsMaxAgeSeconds > 0 && request.isSecure()) {
            response.setHeader(
                    "Strict-Transport-Security",
                    "max-age=" + hstsMaxAgeSeconds + "; includeSubDomains");
        }
        filterChain.doFilter(request, response);
    }
}
