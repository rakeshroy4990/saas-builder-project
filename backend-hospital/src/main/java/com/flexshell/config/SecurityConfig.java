package com.flexshell.config;

import com.flexshell.auth.security.BearerTokenAuthenticator;
import com.flexshell.auth.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
public class SecurityConfig {
    private static final Logger LOG = LoggerFactory.getLogger(SecurityConfig.class);
    @Value("${app.auth.cookie.access-token-name:access_token}")
    private String accessTokenCookieName;

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ObjectProvider<BearerTokenAuthenticator> bearerTokenAuthenticatorProvider,
            ObjectProvider<RequestLocaleFilter> requestLocaleFilterProvider,
            CorsConfigurationSource corsConfigurationSource)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Raw WebSocket upgrade cannot send Authorization; auth runs on STOMP CONNECT (see StompAuthChannelInterceptor).
                        .requestMatchers("/ws", "/ws/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/setup/**").permitAll()
                        .requestMatchers("/api/logs/**").permitAll()
                        .requestMatchers("/api/telemetry/**").permitAll()
                        .requestMatchers("/api/uiMetdata/**", "/api/uiMetdata").permitAll()
                        .requestMatchers("/api/medical-department/get", "/api/medical-department/get/**").permitAll()
                        .requestMatchers("/api/Em/get", "/api/Em/get/**").permitAll()
                        .requestMatchers("/api/youtube/hero-video").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/hospital/blog", "/api/hospital/blog/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/doctor/get", "/api/doctor/get/**").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/notification-rules/**", "/api/v1/domain-action-events/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/users").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/users/save", "/api/user/save").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/users/**", "/api/user/*").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/medical-departments").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/medical-departments/save").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/medical-departments/**").hasRole("ADMIN")
                        // Spring Boot forwards failures to `/error`; must not require auth or the real error is masked.
                        .requestMatchers("/error", "/error/**").permitAll()
                        .requestMatchers("/api/medical-department/create").authenticated()
                        .requestMatchers("/api/medical-department/save", "/api/medical-department/createOrUpdate").authenticated()
                        .requestMatchers("/api/medical-department/update/**").authenticated()
                        .requestMatchers("/api/medical-department/delete/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/medical-department/*").hasRole("ADMIN")
                        .requestMatchers("/api/Em/create").authenticated()
                        .requestMatchers("/api/Em/save", "/api/Em/createOrUpdate").authenticated()
                        .requestMatchers("/api/Em/update/**").authenticated()
                        .requestMatchers("/api/Em/delete/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/Em/*").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            LOG.warn(
                                    "security_unauthenticated method={} uri={} detail={}",
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    authException != null ? authException.getClass().getSimpleName() : "none"
                            );
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            response.getWriter().write("{\"message\":\"Authentication required\",\"code\":\"AUTH_REQUIRED\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            LOG.warn(
                                    "security_access_denied method={} uri={} detail={}",
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    accessDeniedException != null ? accessDeniedException.getClass().getSimpleName() : "none"
                            );
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            response.getWriter().write("{\"message\":\"Forbidden\",\"code\":\"ACCESS_DENIED\"}");
                        }));

        BearerTokenAuthenticator bearerTokenAuthenticator = bearerTokenAuthenticatorProvider.getIfAvailable();
        RequestLocaleFilter requestLocaleFilter = requestLocaleFilterProvider.getIfAvailable();
        if (bearerTokenAuthenticator == null) {
            LOG.error(
                    "BearerTokenAuthenticator bean is missing; JWT filter will not be registered. "
                            + "Most /api/** routes require authentication and will return 403."
            );
        }
        if (bearerTokenAuthenticator != null) {
            JwtAuthenticationFilter jwtAuthenticationFilter = new JwtAuthenticationFilter(
                    bearerTokenAuthenticator,
                    List.of(
                            "/ws",
                            "/api/auth",
                            "/api/setup",
                            "/api/logs",
                            "/api/telemetry",
                            "/api/uiMetdata",
                            "/api/medical-department/get",
                            "/api/Em/get",
                            "/api/v1/medical-departments",
                            "/api/youtube/hero-video",
                            "/api/hospital/blog",
                            "/error",
                            "/actuator"),
                    accessTokenCookieName);
            http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
            if (requestLocaleFilter != null) {
                http.addFilterAfter(requestLocaleFilter, JwtAuthenticationFilter.class);
            }
        } else if (requestLocaleFilter != null) {
            http.addFilterBefore(requestLocaleFilter, UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }
}
