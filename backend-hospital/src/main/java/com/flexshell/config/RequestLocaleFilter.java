package com.flexshell.config;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.i18n.RequestLocaleAttributes;
import com.flexshell.auth.i18n.SupportedLocale;
import com.flexshell.persistence.api.UserAccess;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Resolves request locale: {@code Accept-Language} (active UI) → authenticated {@code PreferredLocale} → {@code en}.
 */
public class RequestLocaleFilter extends OncePerRequestFilter {

    private final ObjectProvider<UserAccess> userAccessProvider;

    public RequestLocaleFilter(ObjectProvider<UserAccess> userAccessProvider) {
        this.userAccessProvider = userAccessProvider;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String preferredLocale = resolvePreferredLocaleFromAuth();
        String locale = SupportedLocale.resolveRequestLocale(
                preferredLocale,
                request.getHeader("Accept-Language")
        );
        request.setAttribute(RequestLocaleAttributes.RESOLVED_LOCALE, locale);
        filterChain.doFilter(request, response);
    }

    private String resolvePreferredLocaleFromAuth() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (!(principal instanceof String userId) || userId.isBlank()) {
            return null;
        }
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            return null;
        }
        return users.findById(userId.trim())
                .map(UserEntity::getPreferredLocale)
                .filter(pl -> pl != null && !pl.isBlank())
                .orElse(null);
    }
}
