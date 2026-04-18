package com.flexshell.config;

import com.flexshell.auth.security.BearerTokenAuthenticator;
import com.flexshell.auth.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {
    @Value("${app.auth.cookie.access-token-name:access_token}")
    private String accessTokenCookieName;

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ObjectProvider<BearerTokenAuthenticator> bearerTokenAuthenticatorProvider,
            CorsConfigurationSource corsConfigurationSource)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/setup/**").permitAll()
                        .requestMatchers("/api/logs/**").permitAll()
                        .requestMatchers("/api/uiMetdata/**", "/api/uiMetdata").permitAll()
                        .requestMatchers("/api/medical-department/get", "/api/medical-department/get/**").permitAll()
                        .requestMatchers("/api/medical-department/create").authenticated()
                        .requestMatchers("/api/medical-department/createOrUpdate").authenticated()
                        .requestMatchers("/api/medical-department/update/**").authenticated()
                        .requestMatchers("/api/medical-department/delete/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated());

        BearerTokenAuthenticator bearerTokenAuthenticator = bearerTokenAuthenticatorProvider.getIfAvailable();
        if (bearerTokenAuthenticator != null) {
            JwtAuthenticationFilter jwtAuthenticationFilter = new JwtAuthenticationFilter(
                    bearerTokenAuthenticator,
                    List.of(
                            "/api/auth",
                            "/api/setup",
                            "/api/logs",
                            "/api/uiMetdata",
                            "/api/medical-department/get",
                            "/error",
                            "/actuator"),
                    accessTokenCookieName);
            http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }
}
