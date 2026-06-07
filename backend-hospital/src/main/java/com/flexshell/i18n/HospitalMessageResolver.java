package com.flexshell.i18n;

import com.flexshell.auth.i18n.SupportedLocale;
import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Resolves localized hospital API copy from Spring {@link MessageSource} bundles.
 * Error codes map {@code APPOINTMENT_NOT_FOUND} → {@code error.appointment.not.found}.
 */
public class HospitalMessageResolver {

    private static final Pattern ERROR_CODE = Pattern.compile("[A-Z][A-Z0-9_]+");

    private final MessageSource messageSource;

    public HospitalMessageResolver(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public String get(String messageKey, String localeCode, Object... args) {
        Locale locale = SupportedLocale.toJavaLocale(localeCode);
        Object[] messageArgs = args == null || args.length == 0 ? null : args;
        try {
            return messageSource.getMessage(messageKey, messageArgs, locale);
        } catch (NoSuchMessageException ex) {
            try {
                return messageSource.getMessage(
                        messageKey,
                        messageArgs,
                        SupportedLocale.toJavaLocale(SupportedLocale.DEFAULT));
            } catch (NoSuchMessageException fallback) {
                return messageKey;
            }
        }
    }

    /** Maps {@code APPOINTMENT_NOT_FOUND} → {@code error.appointment.not.found}. */
    public String forErrorCode(String errorCode, String localeCode) {
        if (errorCode == null || errorCode.isBlank()) {
            return get("error.internal", localeCode);
        }
        String key = "error." + errorCode.trim().toLowerCase(Locale.ROOT).replace('_', '.');
        return get(key, localeCode);
    }

    public boolean isErrorCode(String message) {
        return message != null && ERROR_CODE.matcher(message.trim()).matches();
    }
}
