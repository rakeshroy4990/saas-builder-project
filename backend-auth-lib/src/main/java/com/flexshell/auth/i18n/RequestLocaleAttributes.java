package com.flexshell.auth.i18n;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Request-scoped resolved locale (BCP-47 primary subtag, e.g. {@code en} or {@code hi}).
 */
public final class RequestLocaleAttributes {

    public static final String RESOLVED_LOCALE = "com.flexshell.i18n.RESOLVED_LOCALE";

    private RequestLocaleAttributes() {
    }

    public static String readResolvedLocale(HttpServletRequest request) {
        if (request == null) {
            return SupportedLocale.DEFAULT;
        }
        Object value = request.getAttribute(RESOLVED_LOCALE);
        if (value instanceof String s && !s.isBlank()) {
            return SupportedLocale.normalize(s);
        }
        return SupportedLocale.resolveRequestLocale(
                null,
                request.getHeader("Accept-Language")
        );
    }
}
