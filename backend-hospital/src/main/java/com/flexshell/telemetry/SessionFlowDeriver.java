package com.flexshell.telemetry;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Builds a compact ordered {@code sessionFlow} and {@code flowErrorCount} from {@link SessionSummaryEntryDocument} rows.
 */
public final class SessionFlowDeriver {

    private static final Pattern UUID_SEGMENT =
            Pattern.compile("/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private SessionFlowDeriver() {
    }

    public record FlowDerivation(List<String> steps, int errorCount) {
        public static FlowDerivation empty() {
            return new FlowDerivation(List.of(), 0);
        }
    }

    public static FlowDerivation derive(List<SessionSummaryEntryDocument> summary) {
        if (summary == null || summary.isEmpty()) {
            return FlowDerivation.empty();
        }
        List<String> steps = new ArrayList<>();
        int errors = 0;
        String lastStep = null;
        for (SessionSummaryEntryDocument entry : summary) {
            String step = formatStep(entry);
            if (step.isEmpty()) {
                continue;
            }
            if (step.equals(lastStep)) {
                continue;
            }
            if (isFlowError(entry)) {
                errors++;
            }
            steps.add(step);
            lastStep = step;
        }
        return new FlowDerivation(List.copyOf(steps), errors);
    }

    static String formatStep(SessionSummaryEntryDocument entry) {
        if (entry == null) {
            return "";
        }
        String kind = normalize(entry.getKind()).toLowerCase(Locale.ROOT);
        return switch (kind) {
            case "navigate" -> humanizeLabel(firstNonBlank(entry.getPageId(), basename(entry.getRoutePath()))) + " (page)";
            case "popup_open" -> humanizeLabel(firstNonBlank(
                    attributeString(entry.getAttributes(), "title"),
                    entry.getPopupPageId())) + " (popup)";
            case "button_click" -> humanizeLabel(firstNonBlank(
                    entry.getActionAlias(),
                    entry.getComponentId(),
                    entry.getActionId())) + " (Button clicked)";
            case "api_call", "api_error" -> shortenApiPath(entry.getApiPath())
                    + " (server "
                    + formatHttpStatus(entry.getHttpStatus(), kind)
                    + ")";
            case "auth_login" -> "Login (page)";
            case "auth_logout" -> "Logout (page)";
            case "crash" -> "Crash (client)";
            default -> {
                String label = firstNonBlank(entry.getPageId(), entry.getPopupPageId(), entry.getApiPath(), kind);
                yield label.isEmpty() ? "" : humanizeLabel(label) + " (" + kind + ")";
            }
        };
    }

    static boolean isFlowError(SessionSummaryEntryDocument entry) {
        if (entry == null) {
            return false;
        }
        String kind = normalize(entry.getKind()).toLowerCase(Locale.ROOT);
        if ("api_error".equals(kind) || "crash".equals(kind)) {
            return true;
        }
        if (!normalize(entry.getErrorMessage()).isEmpty()) {
            return true;
        }
        Integer status = entry.getHttpStatus();
        return status != null && status >= 400;
    }

    private static String formatHttpStatus(Integer status, String kind) {
        if (status != null) {
            return String.valueOf(status);
        }
        return "api_error".equals(kind) ? "error" : "—";
    }

    static String shortenApiPath(String apiPath) {
        String path = normalize(apiPath);
        if (path.isEmpty()) {
            return "/unknown";
        }
        int query = path.indexOf('?');
        if (query >= 0) {
            path = path.substring(0, query);
        }
        if (path.startsWith("http://") || path.startsWith("https://")) {
            try {
                path = URI.create(path).getPath();
            } catch (IllegalArgumentException ignored) {
                // keep raw path
            }
        }
        path = UUID_SEGMENT.matcher(path).replaceAll("/{id}");
        if (path.startsWith("/api/v1/")) {
            path = path.substring("/api/v1".length());
        } else if (path.startsWith("/api/")) {
            path = path.substring("/api".length());
        }
        if (path.isEmpty()) {
            return "/unknown";
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        String[] segments = path.split("/");
        if (segments.length <= 2) {
            return path;
        }
        String last = segments[segments.length - 1];
        String prev = segments[segments.length - 2];
        if (last.isBlank()) {
            return "/" + prev;
        }
        if (looksLikeResourceId(last) && !prev.isBlank()) {
            return "/" + prev;
        }
        return "/" + last;
    }

    private static boolean looksLikeResourceId(String segment) {
        if (segment.length() >= 24) {
            return true;
        }
        return segment.matches("\\d+");
    }

    private static String basename(String routePath) {
        String path = normalize(routePath);
        if (path.isEmpty()) {
            return "";
        }
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(slash + 1) : path;
    }

    private static String attributeString(Map<String, Object> attributes, String key) {
        if (attributes == null || key == null) {
            return "";
        }
        Object raw = attributes.get(key);
        return raw == null ? "" : normalize(String.valueOf(raw));
    }

    private static String humanizeLabel(String raw) {
        String value = normalize(raw);
        if (value.isEmpty()) {
            return "Unknown";
        }
        value = value.replace('_', '-');
        String[] parts = value.split("-");
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }
            if (!out.isEmpty()) {
                out.append(' ');
            }
            out.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                out.append(part.substring(1).toLowerCase(Locale.ROOT));
            }
        }
        return out.isEmpty() ? "Unknown" : out.toString();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
