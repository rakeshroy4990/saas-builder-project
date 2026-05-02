package com.flexshell.auth.cookie;

import org.springframework.http.ResponseCookie;
import org.springframework.util.StringUtils;

import java.time.Duration;

/**
 * Central place for auth {@link ResponseCookie} construction.
 * <p>
 * <strong>Invariant:</strong> {@code SameSite=None} is never applied without {@code Secure=true}
 * (browsers require it; misconfiguration is corrected here).
 * </p>
 * Refresh tokens are scoped to {@link #REFRESH_TOKEN_PATH} so they are not sent on unrelated API calls.
 */
public final class AuthResponseCookies {

    /** Only refresh requests should carry the refresh JWT cookie. */
    public static final String REFRESH_TOKEN_PATH = "/api/auth/refresh";

    private AuthResponseCookies() {
    }

    /**
     * Effective SameSite / Secure for access + refresh cookies.
     *
     * @param crossSiteDeployment when true (typical production HTTPS + SPA on another site), uses {@code None} + {@code Secure}
     * @param configSecure        from {@code app.auth.cookie.secure} (often false on local HTTP)
     * @param configSameSite      from {@code app.auth.cookie.same-site}; explicit {@code None} always forces {@code Secure}
     */
    public static EffectiveCookiePolicy resolvePolicy(
            boolean crossSiteDeployment,
            boolean configSecure,
            String configSameSite
    ) {
        String raw = configSameSite == null ? "" : configSameSite.trim();
        String sameSite;
        boolean secure;
        if (crossSiteDeployment) {
            sameSite = "None";
            secure = true;
        } else if ("None".equalsIgnoreCase(raw)) {
            sameSite = "None";
            secure = true;
        } else {
            sameSite = raw.isEmpty() ? "Lax" : raw;
            secure = configSecure;
        }
        if ("None".equalsIgnoreCase(sameSite) && !secure) {
            secure = true;
        }
        return new EffectiveCookiePolicy(sameSite, secure);
    }

    public record EffectiveCookiePolicy(String sameSite, boolean secure) {
    }

    public static ResponseCookie buildRefreshCookie(
            String name,
            String value,
            EffectiveCookiePolicy policy,
            String domain,
            long maxAgeSeconds
    ) {
        return buildHttpOnlyCookie(name, value, policy, domain, REFRESH_TOKEN_PATH, maxAgeSeconds);
    }

    public static ResponseCookie buildAccessCookie(
            String name,
            String value,
            EffectiveCookiePolicy policy,
            String domain,
            String path,
            long maxAgeSeconds
    ) {
        String p = StringUtils.hasText(path) ? path : "/";
        return buildHttpOnlyCookie(name, value, policy, domain, p, maxAgeSeconds);
    }

    private static ResponseCookie buildHttpOnlyCookie(
            String name,
            String value,
            EffectiveCookiePolicy policy,
            String domain,
            String path,
            long maxAgeSeconds
    ) {
        boolean clearing = value == null || value.isEmpty();
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(name, clearing ? "" : value)
                .httpOnly(true)
                .secure(policy.secure())
                .sameSite(policy.sameSite())
                .path(path);
        if (StringUtils.hasText(domain)) {
            b.domain(domain.trim());
        }
        if (clearing) {
            b.maxAge(Duration.ZERO);
        } else {
            long sec = maxAgeSeconds > 0 ? maxAgeSeconds : 1;
            b.maxAge(Duration.ofSeconds(sec));
        }
        return b.build();
    }
}
