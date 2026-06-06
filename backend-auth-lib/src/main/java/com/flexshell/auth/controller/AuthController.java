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
import com.flexshell.auth.cookie.AuthResponseCookies;
import com.flexshell.auth.cookie.AuthResponseCookies.EffectiveCookiePolicy;
import com.flexshell.auth.i18n.ApiMessageResolver;
import com.flexshell.auth.i18n.RequestLocaleAttributes;
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
    private final ApiMessageResolver messages;
    private final boolean cookieSecure;
    private final String cookieSameSite;
    private final String cookieDomain;
    private final boolean crossSiteCookieDeployment;
    private final long refreshCookieMaxAgeSeconds;
    private final long accessCookieMaxAgeSeconds;

    public AuthController(
            AuthFacade authFacade,
            ApiMessageResolver messages,
            @Value("${app.auth.cookie.secure:false}") boolean cookieSecure,
            @Value("${app.auth.cookie.same-site:Lax}") String cookieSameSite,
            @Value("${app.auth.cookie.domain:}") String cookieDomain,
            @Value("${app.auth.cookie.cross-site-deployment:false}") boolean crossSiteCookieDeployment,
            @Value("${app.auth.cookie.refresh-max-age-seconds:2592000}") long refreshCookieMaxAgeSeconds,
            @Value("${app.auth.cookie.access-max-age-seconds:43200}") long accessCookieMaxAgeSeconds
    ) {
        this.authFacade = authFacade;
        this.messages = messages;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
        this.cookieDomain = cookieDomain;
        this.crossSiteCookieDeployment = crossSiteCookieDeployment;
        this.refreshCookieMaxAgeSeconds = refreshCookieMaxAgeSeconds;
        this.accessCookieMaxAgeSeconds = accessCookieMaxAgeSeconds;
    }

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            Optional<LoginResponse> response = authFacade.login(request.getEmailId(), request.getPassword());
            return response
                    .map(login -> {
                        setAuthCookies(servletResponse, login.getAccessToken(), login.getRefreshToken());
                        return ResponseEntity.ok(ApiResponse.success(messages.get("success.auth.login", locale), login));
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(ApiResponse.error(
                                    messages.forErrorCode("AUTH_INVALID_CREDENTIALS", locale),
                                    "AUTH_INVALID_CREDENTIALS")));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(messages.forErrorCode(e.getErrorCode(), locale), e.getErrorCode()));
        }
    }

    @PostMapping(value = "/google-login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<LoginResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            Optional<LoginResponse> response = authFacade.loginWithGoogleAccessToken(request.getAccessToken());
            return response
                    .map(login -> {
                        setAuthCookies(servletResponse, login.getAccessToken(), login.getRefreshToken());
                        return ResponseEntity.ok(ApiResponse.success(messages.get("success.auth.login", locale), login));
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(ApiResponse.error(
                                    messages.forErrorCode("AUTH_GOOGLE_FAILED", locale),
                                    "AUTH_GOOGLE_FAILED")));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(messages.forErrorCode(e.getErrorCode(), locale), e.getErrorCode()));
        }
    }

    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<RegisterResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest servletRequest
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            Optional<RegisterResponse> response = authFacade.register(request);
            return response
                    .map(register -> {
                        String message = messages.get("success.auth.register", locale);
                        if ("PENDING_APPROVAL".equalsIgnoreCase(register.getRoleStatus())) {
                            message = messages.get("success.auth.role_pending", locale);
                        }
                        return ResponseEntity.status(HttpStatus.CREATED)
                                .body(ApiResponse.success(message, register));
                    })
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(ApiResponse.error(
                                    messages.forErrorCode("AUTH_REGISTRATION_FAILED", locale),
                                    "AUTH_REGISTRATION_FAILED")));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(messages.forErrorCode(e.getErrorCode(), locale), e.getErrorCode()));
        }
    }

    @PostMapping(value = "/change-password", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest servletRequest
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            authFacade.changePassword(request);
            return ResponseEntity.ok(ApiResponse.success(messages.get("success.auth.password_changed", locale), null));
        } catch (AuthApiException e) {
            return ResponseEntity.status(httpStatusForAuthApiException(e))
                    .body(ApiResponse.error(messages.forErrorCode(e.getErrorCode(), locale), e.getErrorCode()));
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
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        RefreshTokenRequest effectiveRequest = request == null ? new RefreshTokenRequest() : request;
        if (effectiveRequest.getRefreshToken() == null || effectiveRequest.getRefreshToken().isBlank()) {
            effectiveRequest.setRefreshToken(readCookieValue(servletRequest, REFRESH_TOKEN_COOKIE));
        }
        Optional<RefreshTokenResponse> response = authFacade.refresh(effectiveRequest);
        return response
                .map(refresh -> {
                    setAuthCookies(servletResponse, refresh.getAccessToken(), refresh.getRefreshToken());
                    return ResponseEntity.ok(ApiResponse.success(messages.get("success.auth.token_refreshed", locale), refresh));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error(
                                messages.forErrorCode("AUTH_REFRESH_INVALID", locale),
                                "AUTH_REFRESH_INVALID")));
    }

    @PostMapping(value = "/logout", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestBody(required = false) LogoutRequest request,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        LogoutRequest effectiveRequest = request == null ? new LogoutRequest() : request;
        if (effectiveRequest.getRefreshToken() == null || effectiveRequest.getRefreshToken().isBlank()) {
            effectiveRequest.setRefreshToken(readCookieValue(servletRequest, REFRESH_TOKEN_COOKIE));
        }
        authFacade.logout(effectiveRequest);
        clearAuthCookies(servletResponse);
        return ResponseEntity.ok(ApiResponse.success(messages.get("success.auth.logout", locale), null));
    }

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        EffectiveCookiePolicy policy = AuthResponseCookies.resolvePolicy(
                crossSiteCookieDeployment,
                cookieSecure,
                cookieSameSite
        );
        ResponseCookie accessCookie = AuthResponseCookies.buildAccessCookie(
                ACCESS_TOKEN_COOKIE,
                accessToken,
                policy,
                cookieDomain,
                "/",
                accessCookieMaxAgeSeconds
        );
        ResponseCookie refreshCookie = AuthResponseCookies.buildRefreshCookie(
                REFRESH_TOKEN_COOKIE,
                refreshToken,
                policy,
                cookieDomain,
                refreshCookieMaxAgeSeconds
        );
        response.addHeader("Set-Cookie", accessCookie.toString());
        response.addHeader("Set-Cookie", refreshCookie.toString());
    }

    private void clearAuthCookies(HttpServletResponse response) {
        EffectiveCookiePolicy policy = AuthResponseCookies.resolvePolicy(
                crossSiteCookieDeployment,
                cookieSecure,
                cookieSameSite
        );
        ResponseCookie clearAccessCookie = AuthResponseCookies.buildAccessCookie(
                ACCESS_TOKEN_COOKIE,
                "",
                policy,
                cookieDomain,
                "/",
                0
        );
        ResponseCookie clearRefreshCookie = AuthResponseCookies.buildRefreshCookie(
                REFRESH_TOKEN_COOKIE,
                "",
                policy,
                cookieDomain,
                0
        );
        response.addHeader("Set-Cookie", clearAccessCookie.toString());
        response.addHeader("Set-Cookie", clearRefreshCookie.toString());
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
