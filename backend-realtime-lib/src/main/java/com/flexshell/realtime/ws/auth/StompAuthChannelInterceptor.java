package com.flexshell.realtime.ws.auth;

import com.flexshell.auth.security.AuthTokenException;
import com.flexshell.auth.security.BearerTokenAuthenticator;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Date;
import java.util.Objects;

@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {
    private final ObjectProvider<BearerTokenAuthenticator> authenticatorProvider;
    private final WsSessionAuthRegistry sessionAuthRegistry;

    public StompAuthChannelInterceptor(
            ObjectProvider<BearerTokenAuthenticator> authenticatorProvider,
            WsSessionAuthRegistry sessionAuthRegistry
    ) {
        this.authenticatorProvider = authenticatorProvider;
        this.sessionAuthRegistry = sessionAuthRegistry;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = extractBearer(accessor);
            BearerTokenAuthenticator authenticator = authenticatorProvider.getIfAvailable();
            if (authenticator == null) {
                // Anonymous mode (useful for apps without auth yet).
                String sessionId = Objects.toString(accessor.getSessionId(), "").trim();
                String anonymous = "anonymous:" + (sessionId.isEmpty() ? "unknown" : sessionId);
                sessionAuthRegistry.put(accessor.getSessionId(), new WsSessionAuthRegistry.SessionAuth(anonymous, null));
                return message;
            }
            if (token == null || token.isBlank()) {
                throw new IllegalStateException("You are not logged in. Please login.");
            }

            Authentication authentication = authenticator.authenticate(token.trim());
            accessor.setUser(authentication);
            SecurityContextHolder.getContext().setAuthentication(authentication);

            Instant expiresAt = parseExpIfPresent(token.trim());
            String sessionId = accessor.getSessionId();
            String userId = String.valueOf(authentication.getPrincipal());
            sessionAuthRegistry.put(sessionId, new WsSessionAuthRegistry.SessionAuth(userId, expiresAt));
            return message;
        }

        String sessionId = accessor.getSessionId();
        WsSessionAuthRegistry.SessionAuth auth = sessionAuthRegistry.get(sessionId);
        if (auth != null && auth.expiresAt() != null && Instant.now().isAfter(auth.expiresAt())) {
            throw new AuthTokenException("Invalid or expired token, Please login again.");
        }

        return message;
    }

    @Nullable
    private String extractBearer(StompHeaderAccessor accessor) {
        String auth = accessor.getFirstNativeHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }
        Object fromHandshake = accessor.getSessionAttributes() == null ? null : accessor.getSessionAttributes().get("accessToken");
        if (fromHandshake != null) {
            String token = String.valueOf(fromHandshake).trim();
            if (!token.isEmpty()) return token;
        }
        return null;
    }

    private Instant parseExpIfPresent(String token) {
        try {
            // Parse exp without needing app-specific JwtService.
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            String payloadJson = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(payloadJson);
            if (!node.has("exp")) return null;
            long expSeconds = node.get("exp").asLong(0);
            if (expSeconds <= 0) return null;
            return Instant.ofEpochSecond(expSeconds);
        } catch (Exception ignored) {
            return null;
        }
    }
}

