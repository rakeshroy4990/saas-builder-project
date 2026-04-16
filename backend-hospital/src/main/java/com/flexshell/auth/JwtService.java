package com.flexshell.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private final SecretKey signingKey;
    private final long accessExpirationSeconds;
    private final long refreshExpirationSeconds;
    private final String issuer;

    public JwtService(
            @Value("${app.auth.jwt.secret:change-this-jwt-secret-min-32-bytes}") String secret,
            @Value("${app.auth.jwt.access-expiration-seconds:900}") long accessExpirationSeconds,
            @Value("${app.auth.jwt.refresh-expiration-seconds:2592000}") long refreshExpirationSeconds,
            @Value("${app.auth.jwt.issuer:flexshell-backend}") String issuer
    ) {
        String normalized = secret == null || secret.isBlank()
                ? "change-this-jwt-secret-min-32-bytes"
                : secret.trim();
        this.signingKey = Keys.hmacShaKeyFor(hashKeyBytes(normalized));
        this.accessExpirationSeconds = accessExpirationSeconds;
        this.refreshExpirationSeconds = refreshExpirationSeconds;
        this.issuer = issuer;
    }

    private static byte[] hashKeyBytes(String secret) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm unavailable for JWT key derivation", ex);
        }
    }

    public String generateAccessToken(String subject, String audience, long tokenVersion, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(subject)
                .issuer(issuer)
                .audience().add(audience).and()
                .id(UUID.randomUUID().toString())
                .claim("tokenVersion", tokenVersion)
                .claim("role", role == null ? UserRole.PATIENT.name() : role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessExpirationSeconds)))
                .signWith(signingKey)
                .compact();
    }

    public String generateRefreshToken(String subject, String audience, String deviceId, long tokenVersion) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(subject)
                .issuer(issuer)
                .audience().add(audience).and()
                .id(UUID.randomUUID().toString())
                .claim("tokenVersion", tokenVersion)
                .claim("tokenType", "refresh")
                .claim("deviceId", deviceId == null ? "" : deviceId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(refreshExpirationSeconds)))
                .signWith(signingKey)
                .compact();
    }

    public Claims parseAndValidate(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException ex) {
            log.warn("Invalid JWT token: {}", ex.getMessage());
            throw ex;
        }
    }

    public long getAccessExpirationSeconds() {
        return accessExpirationSeconds;
    }

    public long getRefreshExpirationSeconds() {
        return refreshExpirationSeconds;
    }
}

