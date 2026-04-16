package com.flexshell.realtime.ws.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class AuthCookieHandshakeInterceptor implements HandshakeInterceptor {
    private final String accessTokenCookieName;

    public AuthCookieHandshakeInterceptor(
            @Value("${app.auth.cookie.access-token-name:access_token}") String accessTokenCookieName
    ) {
        this.accessTokenCookieName = accessTokenCookieName;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        if (request instanceof ServletServerHttpRequest servletReq) {
            HttpServletRequest http = servletReq.getServletRequest();
            Cookie[] cookies = http.getCookies();
            if (cookies != null && accessTokenCookieName != null && !accessTokenCookieName.isBlank()) {
                for (Cookie cookie : cookies) {
                    if (cookie != null && accessTokenCookieName.equals(cookie.getName())) {
                        attributes.put("accessToken", cookie.getValue());
                        break;
                    }
                }
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // no-op
    }
}

