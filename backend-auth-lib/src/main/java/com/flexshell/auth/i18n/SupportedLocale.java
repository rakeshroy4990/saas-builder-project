package com.flexshell.auth.i18n;

import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Supported API locales — align with {@code @saas-builder/i18n-contract} ({@code en}, {@code hi}, {@code kn}).
 */
public final class SupportedLocale {

    public static final String DEFAULT = "en";
    public static final Set<String> SUPPORTED = Set.of("en", "hi", "kn");

    private SupportedLocale() {
    }

    public static String normalize(String localeTag) {
        String locale = Objects.toString(localeTag, "").trim().toLowerCase(Locale.ROOT);
        if (locale.contains("-")) {
            locale = locale.substring(0, locale.indexOf('-'));
        }
        if (SUPPORTED.contains(locale)) {
            return locale;
        }
        return DEFAULT;
    }

    /** Parses the first language range from {@code Accept-Language} (e.g. {@code hi-IN,hi;q=0.9,en;q=0.8}). */
    public static String parseAcceptLanguage(String acceptLanguageHeader) {
        if (acceptLanguageHeader == null || acceptLanguageHeader.isBlank()) {
            return DEFAULT;
        }
        String first = acceptLanguageHeader.split(",")[0].trim();
        int semi = first.indexOf(';');
        if (semi >= 0) {
            first = first.substring(0, semi).trim();
        }
        return normalize(first);
    }

    /**
     * Precedence: authenticated profile {@code PreferredLocale} → {@code Accept-Language} → {@code en}.
     */
    public static String resolveRequestLocale(String preferredLocaleFromProfile, String acceptLanguageHeader) {
        if (preferredLocaleFromProfile != null && !preferredLocaleFromProfile.isBlank()) {
            return normalize(preferredLocaleFromProfile);
        }
        return parseAcceptLanguage(acceptLanguageHeader);
    }

    public static Locale toJavaLocale(String localeCode) {
        String code = normalize(localeCode);
        return Locale.forLanguageTag(code);
    }
}
