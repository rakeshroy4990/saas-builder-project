package com.flexshell.i18n;

import org.springframework.context.MessageSource;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.NoSuchMessageException;

import java.util.Locale;

/**
 * Tries delegate sources in order; falls back to the next when a key is missing.
 */
public final class LayeredMessageSource implements MessageSource {

    private final MessageSource[] delegates;

    public LayeredMessageSource(MessageSource... delegates) {
        this.delegates = delegates;
    }

    @Override
    public String getMessage(String code, Object[] args, String defaultMessage, Locale locale) {
        for (MessageSource delegate : delegates) {
            String resolved = delegate.getMessage(code, args, defaultMessage, locale);
            if (resolved != null && !resolved.equals(code)) {
                return resolved;
            }
        }
        return defaultMessage != null ? defaultMessage : code;
    }

    @Override
    public String getMessage(String code, Object[] args, Locale locale) throws NoSuchMessageException {
        NoSuchMessageException last = null;
        for (MessageSource delegate : delegates) {
            try {
                return delegate.getMessage(code, args, locale);
            } catch (NoSuchMessageException ex) {
                last = ex;
            }
        }
        throw last != null ? last : new NoSuchMessageException(code, locale);
    }

    @Override
    public String getMessage(MessageSourceResolvable resolvable, Locale locale) throws NoSuchMessageException {
        NoSuchMessageException last = null;
        for (MessageSource delegate : delegates) {
            try {
                return delegate.getMessage(resolvable, locale);
            } catch (NoSuchMessageException ex) {
                last = ex;
            }
        }
        throw last != null ? last : new NoSuchMessageException(resolvable.toString(), locale);
    }
}
