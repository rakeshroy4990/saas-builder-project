package com.flexshell.auth.i18n;

import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;

import java.util.Locale;

/**
 * Resolves localized API copy from Spring {@link MessageSource} bundles.
 */
public class ApiMessageResolver {

    private final MessageSource messageSource;

    public ApiMessageResolver(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public String get(String messageKey, String localeCode) {
        return get(messageKey, localeCode, null);
    }

    public String get(String messageKey, String localeCode, Object[] args) {
        Locale locale = SupportedLocale.toJavaLocale(localeCode);
        try {
            return messageSource.getMessage(messageKey, args, locale);
        } catch (NoSuchMessageException ex) {
            try {
                return messageSource.getMessage(messageKey, args, SupportedLocale.toJavaLocale(SupportedLocale.DEFAULT));
            } catch (NoSuchMessageException fallback) {
                return messageKey;
            }
        }
    }

    /** Maps {@code AUTH_INVALID_CREDENTIALS} → {@code error.auth.invalid_credentials}. */
    public String forErrorCode(String errorCode, String localeCode) {
        if (errorCode == null || errorCode.isBlank()) {
            return get("error.auth.internal", localeCode);
        }
        String suffix = errorCode.trim();
        if (suffix.regionMatches(true, 0, "AUTH_", 0, 5)) {
            suffix = suffix.substring(5);
        }
        String key = "error.auth." + suffix.toLowerCase(Locale.ROOT);
        return get(key, localeCode);
    }
}
