package com.flexshell.domainevent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.persistence.postgres.model.DomainActionEventJpaEntity;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Component
@Order(Ordered.LOWEST_PRECEDENCE - 20)
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class DomainEventAutoEmitFilter extends OncePerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(DomainEventAutoEmitFilter.class);
    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final DomainActionEventCatalog actionEventCatalog;
    private final DomainEventContextBuilder contextBuilder;
    private final DomainEventPublisher domainEventPublisher;
    private final ObjectMapper objectMapper;

    public DomainEventAutoEmitFilter(
            DomainActionEventCatalog actionEventCatalog,
            DomainEventContextBuilder contextBuilder,
            DomainEventPublisher domainEventPublisher,
            ObjectMapper objectMapper
    ) {
        this.actionEventCatalog = actionEventCatalog;
        this.contextBuilder = contextBuilder;
        this.domainEventPublisher = domainEventPublisher;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!MUTATING_METHODS.contains(request.getMethod().toUpperCase(Locale.ROOT))) {
            return true;
        }
        String path = Objects.toString(request.getRequestURI(), "");
        return path.startsWith("/ws")
                || path.startsWith("/error")
                || path.startsWith("/api/logs")
                || path.startsWith("/api/telemetry")
                || path.startsWith("/api/v1/notifications")
                || path.startsWith("/api/v1/admin/notification-rules")
                || path.startsWith("/api/v1/admin/domain-action-events");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        try {
            filterChain.doFilter(request, wrappedResponse);
        } finally {
            try {
                maybeEmitDomainEvent(request, wrappedResponse);
            } catch (Exception ex) {
                LOG.warn("domain_event_emit_failed method={} uri={}", request.getMethod(), request.getRequestURI(), ex);
            }
            wrappedResponse.copyBodyToResponse();
        }
    }

    private void maybeEmitDomainEvent(HttpServletRequest request, ContentCachingResponseWrapper response) throws IOException {
        int status = response.getStatus();
        if (status < 200 || status >= 300) {
            return;
        }

        String requestPath = request.getRequestURI();
        String method = request.getMethod();
        Optional<DomainActionEventJpaEntity> binding = actionEventCatalog.resolveBinding(method, requestPath);

        ParsedResponse parsedResponse = parseResponseBody(response);
        if (!parsedResponse.success()) {
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String actorUserId = resolveActorUserId(authentication, parsedResponse.dataNode());
        String actorRole = resolveActorRole(authentication);

        if (binding.isPresent()) {
            DomainActionEventJpaEntity config = binding.get();
            if (!passesBindingFilters(config, actorRole, parsedResponse.dataNode())) {
                return;
            }
            Map<String, Object> context = contextBuilder.build(
                    config.getContextProfile(),
                    parsedResponse.dataNode(),
                    requestPath
            );
            domainEventPublisher.publish(config.getEventType(), actorUserId, context);
            return;
        }

        String normalizedPath = DomainEventEndpointNormalizer.normalizePath(requestPath);
        String derivedEventType = DomainEventEndpointNormalizer.deriveEventType(method, normalizedPath);
        Map<String, Object> context = contextBuilder.build("GENERIC", parsedResponse.dataNode(), requestPath);
        domainEventPublisher.publish(derivedEventType, actorUserId, context);
    }

    private static boolean passesBindingFilters(
            DomainActionEventJpaEntity config,
            String actorRole,
            JsonNode dataNode
    ) {
        String requiredRole = Objects.toString(config.getActorRoleFilter(), "").trim();
        if (!requiredRole.isBlank()
                && (actorRole == null || !requiredRole.equalsIgnoreCase(actorRole))) {
            return false;
        }

        String roleField = Objects.toString(config.getResponseRoleField(), "").trim();
        String roleValue = Objects.toString(config.getResponseRoleValue(), "").trim();
        if (!roleField.isBlank() && !roleValue.isBlank()) {
            String actual = readJsonField(dataNode, roleField);
            return roleValue.equalsIgnoreCase(actual);
        }
        return true;
    }

    private ParsedResponse parseResponseBody(ContentCachingResponseWrapper response) throws IOException {
        byte[] body = response.getContentAsByteArray();
        if (body.length == 0) {
            return ParsedResponse.failed();
        }
        Charset charset = resolveCharset(response.getCharacterEncoding());
        JsonNode root = objectMapper.readTree(new String(body, charset));
        boolean success = root.path("Success").asBoolean(false) || root.path("success").asBoolean(false);
        if (!success) {
            return ParsedResponse.failed();
        }
        JsonNode data = root.has("Data") ? root.get("Data") : root.get("data");
        if (data == null || data.isNull()) {
            data = objectMapper.createObjectNode();
        }
        return new ParsedResponse(true, data);
    }

    private static String resolveActorUserId(Authentication authentication, JsonNode dataNode) {
        if (authentication != null && authentication.isAuthenticated()) {
            String name = Objects.toString(authentication.getName(), "").trim();
            if (!name.isBlank() && !"anonymousUser".equalsIgnoreCase(name)) {
                return name;
            }
        }
        String userId = readJsonField(dataNode, "userId");
        if (!userId.isBlank()) {
            return userId;
        }
        return readJsonField(dataNode, "id");
    }

    private static String resolveActorRole(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return null;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElse(null);
    }

    private static String readJsonField(JsonNode node, String fieldName) {
        if (node == null || fieldName == null || fieldName.isBlank()) {
            return "";
        }
        JsonNode direct = node.get(fieldName);
        if (direct != null && !direct.isNull()) {
            return direct.asText("").trim();
        }
        var fields = node.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            if (entry.getKey().equalsIgnoreCase(fieldName)) {
                return entry.getValue().asText("").trim();
            }
        }
        return "";
    }

    private static Charset resolveCharset(String encoding) {
        if (encoding == null || encoding.isBlank()) {
            return StandardCharsets.UTF_8;
        }
        try {
            return Charset.forName(encoding);
        } catch (Exception ex) {
            return StandardCharsets.UTF_8;
        }
    }

    private record ParsedResponse(boolean success, JsonNode dataNode) {
        private ParsedResponse {
        }

        private static ParsedResponse failed() {
            return new ParsedResponse(false, null);
        }
    }
}
