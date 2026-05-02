package com.flexshell.auth.controller;

import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.api.AuthFacade;
import com.flexshell.auth.api.ApiResponse;
import com.flexshell.auth.api.GoogleLoginRequest;
import com.flexshell.auth.api.LoginRequest;
import com.flexshell.auth.api.LoginResponse;
import com.flexshell.auth.api.LogoutRequest;
import com.flexshell.auth.api.RefreshTokenRequest;
import com.flexshell.auth.api.RefreshTokenResponse;
import com.flexshell.auth.api.ChangePasswordRequest;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final String ACCESS_TOKEN_COOKIE = "access_token";
    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";
    private final AuthFacade authFacade;
    private final boolean cookieSecure;
    private final String cookieSameSite;
    private final String cookieDomain;

    public AuthController(
            AuthFacade authFacade,
            @Value("${app.auth.cookie.secure:false}") boolean cookieSecure,
            @Value("${app.auth.cookie.same-site:Lax}") String cookieSameSite,
            @Value("${app.auth.cookie.domain:}") String cookieDomain
    ) {
        this.authFacade = authFacade;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
        this.cookieDomain = cookieDomain;
    }

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse servletResponse
    ) {
        try {
            Optional<LoginResponse> response = authFacade.login(request.getEmailId(), request.getPassword());
            return response
                    .map(login -> {
                        setAuthCookies(servletResponse, login.getAccessToken(), login.getRefreshToken());
                        return ResponseEntity.ok(ApiResponse.success("Login successful", login));
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(ApiResponse.error("Invalid email or password", "AUTH_INVALID_CREDENTIALS")));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(e.getMessage(), e.getErrorCode()));
        }
    }

    @PostMapping(value = "/google-login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<LoginResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request,
            HttpServletResponse servletResponse
    ) {
        try {
            Optional<LoginResponse> response = authFacade.loginWithGoogleAccessToken(request.getAccessToken());
            return response
                    .map(login -> {
                        setAuthCookies(servletResponse, login.getAccessToken(), login.getRefreshToken());
                        return ResponseEntity.ok(ApiResponse.success("Login successful", login));
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(ApiResponse.error("Google sign-in failed.", "AUTH_GOOGLE_FAILED")));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(e.getMessage(), e.getErrorCode()));
        }
    }

    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        try {
            Optional<RegisterResponse> response = authFacade.register(request);
            return response
                    .map(register -> {
                        String message = "User registered successfully";
                        if ("PENDING_APPROVAL".equalsIgnoreCase(register.getRoleStatus())) {
                            message = "Role request submitted for approval";
                        }
                        return ResponseEntity.status(HttpStatus.CREATED)
                                .body(ApiResponse.success(message, register));
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(ApiResponse.error("Registration could not be completed.", "AUTH_REGISTRATION_FAILED")));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(e.getMessage(), e.getErrorCode()));
        }
    }

    @PostMapping(value = "/change-password", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        try {
            authFacade.changePassword(request);
            return ResponseEntity.ok(ApiResponse.success(
                    "Your password has been updated successfully. Please log in with your new password.",
                    null));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(e.getMessage(), e.getErrorCode()));
        }
    }

    private static HttpStatus httpStatusForAuthApiException(AuthApiException e) {
        String code = e.getErrorCode() == null ? "" : e.getErrorCode();
        return switch (code) {
            case "AUTH_ACCOUNT_DEACTIVATED", "AUTH_ROLE_PENDING_APPROVAL", "AUTH_ROLE_BLOCKED" -> HttpStatus.FORBIDDEN;
            case "AUTH_ACCOUNT_EXISTS", "AUTH_ACCOUNT_INACTIVE" -> HttpStatus.CONFLICT;
            case "AUTH_USER_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "AUTH_INVALID_OLD_PASSWORD" -> HttpStatus.UNAUTHORIZED;
            case "AUTH_PASSWORD_POLICY", "AUTH_PASSWORD_UNCHANGED", "AUTH_VALIDATION_FAILED", "AUTH_CHANGE_PASSWORD_FAILED" ->
                    HttpStatus.BAD_REQUEST;
            default -> HttpStatus.UNAUTHORIZED;
        };
    }

    @PostMapping(value = "/refresh", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<RefreshTokenResponse>> refresh(
            @RequestBody(required = false) RefreshTokenRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        RefreshTokenRequest effectiveRequest = request == null ? new RefreshTokenRequest() : request;
        if (effectiveRequest.getRefreshToken() == null || effectiveRequest.getRefreshToken().isBlank()) {
            effectiveRequest.setRefreshToken(readCookieValue(servletRequest, REFRESH_TOKEN_COOKIE));
        }
        Optional<RefreshTokenResponse> response = authFacade.refresh(effectiveRequest);
        return response
                .map(refresh -> {
                    setAuthCookies(servletResponse, refresh.getAccessToken(), refresh.getRefreshToken());
                    return ResponseEntity.ok(ApiResponse.success("Token refreshed", refresh));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Invalid refresh token", "AUTH_REFRESH_INVALID")));
    }

    @PostMapping(value = "/logout", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestBody(required = false) LogoutRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        LogoutRequest effectiveRequest = request == null ? new LogoutRequest() : request;
        if (effectiveRequest.getRefreshToken() == null || effectiveRequest.getRefreshToken().isBlank()) {
            effectiveRequest.setRefreshToken(readCookieValue(servletRequest, REFRESH_TOKEN_COOKIE));
        }
        boolean loggedOut = authFacade.logout(effectiveRequest);
        clearAuthCookies(servletResponse);
        if (!loggedOut) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid refresh token", "AUTH_LOGOUT_INVALID"));
        }
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully", null));
    }

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        ResponseCookie accessCookie = buildCookie(ACCESS_TOKEN_COOKIE, accessToken, "/").build();
        ResponseCookie refreshCookie = buildCookie(REFRESH_TOKEN_COOKIE, refreshToken, "/api/auth").build();
        response.addHeader("Set-Cookie", accessCookie.toString());
        response.addHeader("Set-Cookie", refreshCookie.toString());
    }

    private void clearAuthCookies(HttpServletResponse response) {
        ResponseCookie clearAccessCookie = buildCookie(ACCESS_TOKEN_COOKIE, "", "/").maxAge(0).build();
        ResponseCookie clearRefreshCookie = buildCookie(REFRESH_TOKEN_COOKIE, "", "/api/auth").maxAge(0).build();
        response.addHeader("Set-Cookie", clearAccessCookie.toString());
        response.addHeader("Set-Cookie", clearRefreshCookie.toString());
    }

    private ResponseCookie.ResponseCookieBuilder buildCookie(String name, String value, String path) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value == null ? "" : value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path(path);
        if (cookieDomain != null && !cookieDomain.isBlank()) {
            builder.domain(cookieDomain);
        }
        return builder;
    }

    private String readCookieValue(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}

