package com.flexshell.domainevent;

import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

public final class DomainEventEndpointNormalizer {

    private static final Pattern UUID_SEGMENT = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            Pattern.CASE_INSENSITIVE
    );

    private DomainEventEndpointNormalizer() {
    }

    public static String normalizePath(String servletPath) {
        String path = Objects.toString(servletPath, "").trim();
        if (path.isBlank()) {
            return "/";
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        String[] segments = path.split("/");
        StringBuilder normalized = new StringBuilder();
        for (String segment : segments) {
            if (segment.isBlank()) {
                continue;
            }
            normalized.append('/');
            if (isDynamicSegment(segment)) {
                normalized.append("{id}");
            } else {
                normalized.append(segment);
            }
        }
        return normalized.isEmpty() ? "/" : normalized.toString();
    }

    public static String deriveEventType(String httpMethod, String normalizedPath) {
        String method = Objects.toString(httpMethod, "GET").trim().toUpperCase(Locale.ROOT);
        String path = normalizedPath == null ? "/" : normalizedPath;
        String resourcePath = path.startsWith("/api/") ? path.substring(4) : path;
        resourcePath = resourcePath.replace("{id}", "id");
        String[] segments = resourcePath.split("/");
        StringBuilder builder = new StringBuilder(method);
        for (String segment : segments) {
            if (segment.isBlank()) {
                continue;
            }
            builder.append('_').append(segment.replace('-', '_').toUpperCase(Locale.ROOT));
        }
        return builder.toString();
    }

    public static boolean matchesPattern(String requestPath, String endpointPattern) {
        String path = Objects.toString(requestPath, "").trim();
        String pattern = Objects.toString(endpointPattern, "").trim();
        if (path.isBlank() || pattern.isBlank()) {
            return false;
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        if (!pattern.startsWith("/")) {
            pattern = "/" + pattern;
        }
        String regex = pattern
                .replace("/", "\\/")
                .replaceAll("\\{[^}]+\\}", "[^/]+");
        return path.matches(regex);
    }

    private static boolean isDynamicSegment(String segment) {
        if (UUID_SEGMENT.matcher(segment).matches()) {
            return true;
        }
        if (segment.length() >= 8 && segment.matches("^[A-Za-z0-9_-]+$") && segment.matches(".*\\d.*")) {
            return true;
        }
        return segment.length() >= 20 && segment.matches("^[A-Za-z0-9_-]+$");
    }
}
