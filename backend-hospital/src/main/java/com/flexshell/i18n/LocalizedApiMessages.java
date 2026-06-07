package com.flexshell.i18n;

import com.flexshell.auth.i18n.RequestLocaleAttributes;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Convenience wrapper for localized hospital API envelope messages.
 */
public class LocalizedApiMessages {

    private final HospitalMessageResolver resolver;

    public LocalizedApiMessages(HospitalMessageResolver resolver) {
        this.resolver = resolver;
    }

    public String get(String key, Object... args) {
        return resolver.get(key, currentLocale(), args);
    }

    public String get(String key, HttpServletRequest request, Object... args) {
        return resolver.get(key, localeFrom(request), args);
    }

    public String get(String key, String locale, Object... args) {
        return resolver.get(key, locale, args);
    }

    public String forErrorCode(String errorCode) {
        return resolver.forErrorCode(errorCode, currentLocale());
    }

    public String forErrorCode(String errorCode, HttpServletRequest request) {
        return resolver.forErrorCode(errorCode, localeFrom(request));
    }

    public String forErrorCode(String errorCode, String locale) {
        return resolver.forErrorCode(errorCode, locale);
    }

    public String success(String key, Object... args) {
        return get(key, args);
    }

    public String success(HttpServletRequest request, String key, Object... args) {
        return get(key, request, args);
    }

    public String resolveException(IllegalArgumentException ex, String fallbackErrorCode) {
        return resolveException(currentLocale(), ex, fallbackErrorCode);
    }

    public String resolveException(Throwable ex, String fallbackErrorCode) {
        if (ex instanceof IllegalArgumentException illegalArgumentException) {
            return resolveException(illegalArgumentException, fallbackErrorCode);
        }
        String message = ex.getMessage();
        if (resolver.isErrorCode(message)) {
            return resolver.forErrorCode(message.trim(), currentLocale());
        }
        return resolver.forErrorCode(fallbackErrorCode, currentLocale());
    }

    public String resolveException(HttpServletRequest request, IllegalArgumentException ex, String fallbackErrorCode) {
        return resolveException(localeFrom(request), ex, fallbackErrorCode);
    }

    public String resolveException(String locale, IllegalArgumentException ex, String fallbackErrorCode) {
        String message = ex.getMessage();
        if (resolver.isErrorCode(message)) {
            return resolver.forErrorCode(message.trim(), locale);
        }
        return resolver.forErrorCode(fallbackErrorCode, locale);
    }

    private String currentLocale() {
        HttpServletRequest request = currentRequest();
        if (request != null) {
            return RequestLocaleAttributes.readResolvedLocale(request);
        }
        return com.flexshell.auth.i18n.SupportedLocale.DEFAULT;
    }

    private static String localeFrom(HttpServletRequest request) {
        return RequestLocaleAttributes.readResolvedLocale(request);
    }

    private static HttpServletRequest currentRequest() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            return servletAttributes.getRequest();
        }
        return null;
    }
}
