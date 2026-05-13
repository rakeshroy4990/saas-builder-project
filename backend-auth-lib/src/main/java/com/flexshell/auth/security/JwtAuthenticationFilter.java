package com.flexshell.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private final BearerTokenAuthenticator authenticator;
    private final List<String> publicPathPrefixes;
    private final String accessTokenCookieName;

    public JwtAuthenticationFilter(
            BearerTokenAuthenticator authenticator,
            List<String> publicPathPrefixes,
            String accessTokenCookieName
    ) {
        this.authenticator = authenticator;
        this.publicPathPrefixes = publicPathPrefixes;
        this.accessTokenCookieName = accessTokenCookieName;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return publicPathPrefixes.stream().anyMatch(path::startsWith);
    }

    /**
     * Spring MVC runs {@code StreamingResponseBody} during an {@code ASYNC} servlet dispatch. The default
     * {@link OncePerRequestFilter} skips async dispatches, so {@code SecurityContextHolder} is empty when
     * {@code AuthorizationFilter} runs again — leading to {@code AuthorizationDeniedException}. Re-run this
     * filter on async so the JWT (cookie or header) is applied before authorization.
     */
    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }
        if (token == null || token.isEmpty()) {
            token = readCookie(request, accessTokenCookieName);
        }
        if (token == null || token.isEmpty()) {
            LOG.warn(
                    "jwt_auth_missing_token method={} path={}",
                    request.getMethod(),
                    request.getRequestURI()
            );
            unauthorized(response, "You are not logged in. Please login.");
            return;
        }

        try {
            Authentication authentication = authenticator.authenticate(token);
            request.setAttribute(AuthRequestAttributes.RAW_ACCESS_TOKEN, token.trim());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (AuthTokenException ex) {
            SecurityContextHolder.clearContext();
            LOG.warn(
                    "jwt_auth_rejected method={} path={} reason={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    ex.getMessage()
            );
            unauthorized(response, ex.getMessage());
        }
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"message\":\"" + message + "\",\"code\":\"AUTH_UNAUTHORIZED\"}");
    }

    private String readCookie(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null || cookieName == null || cookieName.isBlank()) return null;
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
