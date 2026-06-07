package com.flexshell.auth.google;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifies native mobile Google ID tokens locally using cached Google JWKS (no per-login userinfo call).
 */
@Component
public class GoogleIdTokenVerifier {
    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifier.class);
    private static final String GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
    private static final String GOOGLE_ISSUER = "https://accounts.google.com";
    private static final Duration JWKS_CACHE_TTL = Duration.ofHours(1);

    private final String webClientId;
    private final RestClient googleHttp;
    private final ObjectMapper objectMapper;
    private final Map<String, PublicKey> keysByKid = new ConcurrentHashMap<>();
    private volatile Instant jwksExpiresAt = Instant.EPOCH;

    public GoogleIdTokenVerifier(
            @Value("${app.google.oauth.web-client-id:}") String webClientId,
            ObjectMapper objectMapper
    ) {
        this.webClientId = webClientId == null ? "" : webClientId.trim();
        this.objectMapper = objectMapper;
        this.googleHttp = RestClient.builder().build();
    }

    public boolean isConfigured() {
        return !webClientId.isEmpty();
    }

    public Optional<VerifiedGoogleProfile> verify(String rawIdToken) {
        if (!isConfigured() || rawIdToken == null || rawIdToken.isBlank()) {
            return Optional.empty();
        }
        try {
            String kid = extractKid(rawIdToken.trim());
            if (kid.isEmpty()) {
                return Optional.empty();
            }
            PublicKey key = resolveSigningKey(kid);
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(GOOGLE_ISSUER)
                    .build()
                    .parseSignedClaims(rawIdToken.trim())
                    .getPayload();
            if (!audienceMatches(claims)) {
                log.warn("Google id_token rejected: audience mismatch");
                return Optional.empty();
            }
            String email = stringClaim(claims, "email").trim().toLowerCase();
            if (email.isEmpty()) {
                return Optional.empty();
            }
            if (!emailVerified(claims)) {
                log.warn("Google id_token rejected: email not verified");
                return Optional.empty();
            }
            String givenName = stringClaim(claims, "given_name");
            String familyName = stringClaim(claims, "family_name");
            String fullName = stringClaim(claims, "name");
            if (givenName.isEmpty() && familyName.isEmpty() && !fullName.isEmpty()) {
                String[] parts = fullName.trim().split("\\s+", 2);
                givenName = parts[0].trim();
                familyName = parts.length > 1 ? parts[1].trim() : "";
            }
            return Optional.of(new VerifiedGoogleProfile(email, givenName, familyName, "", ""));
        } catch (JwtException | IllegalArgumentException ex) {
            log.warn("Google id_token verification failed: {}", ex.toString());
            return Optional.empty();
        }
    }

    private boolean audienceMatches(Claims claims) {
        Object aud = claims.get("aud");
        if (aud instanceof String s) {
            return webClientId.equals(s);
        }
        if (aud instanceof Collection<?> col) {
            return col.stream().anyMatch(value -> webClientId.equals(String.valueOf(value)));
        }
        return false;
    }

    private static boolean emailVerified(Claims claims) {
        Object verified = claims.get("email_verified");
        if (verified instanceof Boolean b) {
            return b;
        }
        if (verified != null) {
            return Boolean.parseBoolean(String.valueOf(verified));
        }
        return true;
    }

    private static String stringClaim(Claims claims, String name) {
        Object value = claims.get(name);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private PublicKey resolveSigningKey(String kid) {
        if (Instant.now().isBefore(jwksExpiresAt) && keysByKid.containsKey(kid)) {
            return keysByKid.get(kid);
        }
        synchronized (this) {
            if (Instant.now().isBefore(jwksExpiresAt)) {
                PublicKey cached = keysByKid.get(kid);
                if (cached != null) {
                    return cached;
                }
            }
            refreshJwks();
            PublicKey key = keysByKid.get(kid);
            if (key == null) {
                throw new IllegalArgumentException("Unknown Google signing key kid=" + kid);
            }
            return key;
        }
    }

    private void refreshJwks() {
        try {
            String body = googleHttp.get().uri(GOOGLE_JWKS_URL).retrieve().body(String.class);
            if (body == null || body.isBlank()) {
                throw new IllegalStateException("Empty Google JWKS response");
            }
            JsonNode keys = objectMapper.readTree(body).path("keys");
            Map<String, PublicKey> next = new ConcurrentHashMap<>();
            if (keys.isArray()) {
                for (JsonNode keyNode : keys) {
                    String kid = keyNode.path("kid").asText("").trim();
                    String n = keyNode.path("n").asText("").trim();
                    String e = keyNode.path("e").asText("").trim();
                    if (kid.isEmpty() || n.isEmpty() || e.isEmpty()) {
                        continue;
                    }
                    next.put(kid, toRsaPublicKey(n, e));
                }
            }
            if (next.isEmpty()) {
                throw new IllegalStateException("Google JWKS contained no usable keys");
            }
            keysByKid.clear();
            keysByKid.putAll(next);
            jwksExpiresAt = Instant.now().plus(JWKS_CACHE_TTL);
        } catch (RestClientException | IllegalStateException ex) {
            log.warn("Failed to refresh Google JWKS: {}", ex.toString());
            if (keysByKid.isEmpty()) {
                throw new IllegalArgumentException("Google JWKS unavailable", ex);
            }
        } catch (Exception ex) {
            log.warn("Failed to parse Google JWKS: {}", ex.toString());
            if (keysByKid.isEmpty()) {
                throw new IllegalArgumentException("Google JWKS parse failed", ex);
            }
        }
    }

    private String extractKid(String jwt) {
        try {
            int firstDot = jwt.indexOf('.');
            int secondDot = jwt.indexOf('.', firstDot + 1);
            if (firstDot < 0 || secondDot < 0) {
                return "";
            }
            String headerJson = new String(Base64.getUrlDecoder().decode(jwt.substring(0, firstDot)));
            return objectMapper.readTree(headerJson).path("kid").asText("").trim();
        } catch (Exception ex) {
            return "";
        }
    }

    private static PublicKey toRsaPublicKey(String modulusUrl, String exponentUrl) {
        try {
            byte[] modulusBytes = Base64.getUrlDecoder().decode(modulusUrl);
            byte[] exponentBytes = Base64.getUrlDecoder().decode(exponentUrl);
            RSAPublicKeySpec spec = new RSAPublicKeySpec(new BigInteger(1, modulusBytes), new BigInteger(1, exponentBytes));
            return KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid RSA JWK", ex);
        }
    }

    public record VerifiedGoogleProfile(
            String email,
            String givenName,
            String familyName,
            String gender,
            String mobileNumber
    ) {
    }
}
