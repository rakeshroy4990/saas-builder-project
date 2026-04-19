package com.flexshell.auth.security;

import com.flexshell.auth.JwtService;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class HospitalBearerTokenAuthenticator implements BearerTokenAuthenticator {
    private final JwtService jwtService;
    private final ObjectProvider<UserRepository> userRepositoryProvider;

    public HospitalBearerTokenAuthenticator(JwtService jwtService, ObjectProvider<UserRepository> userRepositoryProvider) {
        this.jwtService = jwtService;
        this.userRepositoryProvider = userRepositoryProvider;
    }

    @Override
    public Authentication authenticate(String token) throws AuthTokenException {
        final Claims claims;
        try {
            claims = jwtService.parseAndValidate(token);
        } catch (JwtException | IllegalArgumentException ex) {
            throw new AuthTokenException("Invalid or expired token, Please login again.");
        }

        String subject = claims.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new AuthTokenException("Token subject is missing");
        }
        String tokenType = claims.get("tokenType", String.class);
        if ("refresh".equalsIgnoreCase(tokenType)) {
            throw new AuthTokenException("Refresh token cannot be used as access token");
        }
        if (claims.getAudience() == null || !claims.getAudience().contains("web")) {
            throw new AuthTokenException("Invalid token audience");
        }

        UserRepository userRepository = userRepositoryProvider.getIfAvailable();
        if (userRepository == null) {
            throw new AuthTokenException("User repository unavailable");
        }

        UserEntity user = resolveUser(userRepository, subject)
                .orElseThrow(() -> new AuthTokenException("User not found"));
        if (!user.isActive()) {
            throw new AuthTokenException("Account is inactive");
        }

        Number tokenVersionClaim = claims.get("tokenVersion", Number.class);
        long tokenVersion = tokenVersionClaim == null ? 0L : tokenVersionClaim.longValue();
        if (tokenVersion != user.getTokenVersion()) {
            throw new AuthTokenException("Token version mismatch");
        }
        String tokenRole = claims.get("role", String.class);
        String dbRole = user.getRole() == null ? UserRole.PATIENT.name() : user.getRole().name();
        if (tokenRole != null && !tokenRole.equalsIgnoreCase(dbRole)) {
            throw new AuthTokenException("Token role mismatch");
        }

        return new UsernamePasswordAuthenticationToken(
                user.getId(),
                null,
                List.of(
                        new SimpleGrantedAuthority("ROLE_USER"),
                        new SimpleGrantedAuthority("ROLE_" + dbRole)));
    }

    private Optional<UserEntity> resolveUser(UserRepository userRepository, String subject) {
        String normalizedSubject = subject == null ? "" : subject.trim();
        if (normalizedSubject.isEmpty()) {
            return Optional.empty();
        }
        Optional<UserEntity> byId = userRepository.findById(normalizedSubject);
        if (byId.isPresent()) {
            return byId;
        }
        if (ObjectId.isValid(normalizedSubject)) {
            Optional<UserEntity> byObjectId = userRepository.findByObjectId(new ObjectId(normalizedSubject));
            if (byObjectId.isPresent()) {
                return byObjectId;
            }
        }
        return userRepository.findByEmail(normalizedSubject);
    }
}
