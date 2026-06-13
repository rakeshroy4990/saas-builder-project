package com.flexshell.controller.support;

import com.flexshell.auth.security.AuthRequestAttributes;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Builds an {@code Authorization: Bearer …} value for pdf-rag proxy calls when the browser
 * authenticated via httpOnly access-token cookie (no {@code Authorization} request header).
 */
public final class RagProxyAuthorizationSupport {

    private RagProxyAuthorizationSupport() {
    }

    public static String resolveBearerAuthorization(HttpServletRequest request, String accessTokenCookieName) {
        return resolveBearerAuthorization(request, request.getHeader("Authorization"), accessTokenCookieName);
    }

    public static String resolveBearerAuthorization(
            HttpServletRequest request,
            String authorizationHeader,
            String accessTokenCookieName
    ) {
        Object rawAttr = request.getAttribute(AuthRequestAttributes.RAW_ACCESS_TOKEN);
        if (rawAttr instanceof String token && !token.isBlank()) {
            String trimmed = token.trim();
            return trimmed.startsWith("Bearer ") ? trimmed : "Bearer " + trimmed;
        }
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            return authorizationHeader.trim();
        }
        String fromCookie = readAccessTokenCookie(request, accessTokenCookieName);
        if (fromCookie == null || fromCookie.isBlank()) {
            return null;
        }
        return "Bearer " + fromCookie.trim();
    }

    private static String readAccessTokenCookie(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookieName == null || cookieName.isBlank()) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
