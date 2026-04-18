package com.flexshell.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    /**
     * Comma-separated list (e.g. from {@code APP_CORS_ALLOWED_ORIGIN_PATTERNS} on Render). Splitting here
     * is reliable; binding {@code @Value} directly to {@code String[]} can end up with a single element
     * containing the whole string, in which case no browser origin would match and preflight would fail
     * with no {@code Access-Control-Allow-Origin}.
     */
    @Value("${app.cors.allowed-origin-patterns:http://localhost:*,https://localhost:*}")
    private String allowedOriginPatterns;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] patterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        registry.addMapping("/api/**")
                .allowedOriginPatterns(patterns)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
