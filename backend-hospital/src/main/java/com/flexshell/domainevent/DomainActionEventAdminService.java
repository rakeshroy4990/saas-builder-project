package com.flexshell.domainevent;

import com.flexshell.controller.dto.CreateDomainActionEventRequest;
import com.flexshell.controller.dto.DomainActionEventQueryDto;
import com.flexshell.controller.dto.DomainActionEventResponse;
import com.flexshell.controller.dto.DomainActionEventSaveRequest;
import com.flexshell.controller.dto.PagedDomainActionEventListDto;
import com.flexshell.controller.dto.UpdateDomainActionEventRequest;
import com.flexshell.controller.support.EntityQuerySupport;
import com.flexshell.persistence.postgres.model.DomainActionEventJpaEntity;
import com.flexshell.persistence.postgres.repository.DomainActionEventJpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class DomainActionEventAdminService {

    private static final Set<String> ALLOWED_PROFILES = Set.of("APPOINTMENT", "USER", "GENERIC");

    private final DomainActionEventJpaRepository repository;

    public DomainActionEventAdminService(DomainActionEventJpaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<DomainActionEventResponse> listBindings() {
        return listBindingsPaged(0, Integer.MAX_VALUE, new DomainActionEventQueryDto()).getContent();
    }

    @Transactional(readOnly = true)
    public PagedDomainActionEventListDto listBindingsPaged(int page, int size, DomainActionEventQueryDto query) {
        int safePage = EntityQuerySupport.safePage(page);
        int safeSize = EntityQuerySupport.safeSize(size);
        List<DomainActionEventResponse> filtered = repository.findByDeletedFalseOrderByHttpMethodAscEndpointPatternAsc().stream()
                .filter(row -> matchesQuery(row, query))
                .map(this::toResponse)
                .toList();
        int total = filtered.size();
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        List<DomainActionEventResponse> content = filtered.subList(from, to);
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new PagedDomainActionEventListDto(content, total, totalPages, safePage, safeSize);
    }

    @Transactional
    public DomainActionEventResponse saveBinding(DomainActionEventSaveRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("DOMAIN_ACTION_EVENT_REQUEST_REQUIRED");
        }
        if (request.getExternalId() != null) {
            UpdateDomainActionEventRequest update = new UpdateDomainActionEventRequest();
            update.setEventType(request.getEventType());
            update.setContextProfile(request.getContextProfile());
            update.setActorRoleFilter(request.getActorRoleFilter());
            update.setResponseRoleField(request.getResponseRoleField());
            update.setResponseRoleValue(request.getResponseRoleValue());
            update.setEnabled(request.getEnabled());
            return updateBinding(request.getExternalId(), update);
        }
        CreateDomainActionEventRequest create = new CreateDomainActionEventRequest();
        create.setHttpMethod(request.getHttpMethod());
        create.setEndpointPattern(request.getEndpointPattern());
        create.setEventType(request.getEventType());
        create.setContextProfile(request.getContextProfile());
        create.setActorRoleFilter(request.getActorRoleFilter());
        create.setResponseRoleField(request.getResponseRoleField());
        create.setResponseRoleValue(request.getResponseRoleValue());
        create.setEnabled(request.getEnabled());
        return createBinding(create);
    }

    @Transactional
    public DomainActionEventResponse createBinding(CreateDomainActionEventRequest request) {
        String httpMethod = requireText(request.getHttpMethod(), "httpMethod").toUpperCase(Locale.ROOT);
        String endpointPattern = normalizeEndpointPattern(requireText(request.getEndpointPattern(), "endpointPattern"));
        String eventType = requireText(request.getEventType(), "eventType").toUpperCase(Locale.ROOT);
        String contextProfile = normalizeProfile(request.getContextProfile());

        repository.findByHttpMethodIgnoreCaseAndEndpointPatternIgnoreCaseAndDeletedFalse(httpMethod, endpointPattern)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("DOMAIN_ACTION_EVENT_ALREADY_EXISTS");
                });

        DomainActionEventJpaEntity row = new DomainActionEventJpaEntity();
        row.setHttpMethod(httpMethod);
        row.setEndpointPattern(endpointPattern);
        row.setEventType(eventType);
        row.setContextProfile(contextProfile);
        row.setActorRoleFilter(blankToNull(request.getActorRoleFilter()));
        row.setResponseRoleField(blankToNull(request.getResponseRoleField()));
        row.setResponseRoleValue(blankToNull(request.getResponseRoleValue()));
        row.setEnabled(request.getEnabled() == null || request.getEnabled());
        row.setDeleted(false);
        return toResponse(repository.save(row));
    }

    @Transactional
    public DomainActionEventResponse updateBinding(UUID externalId, UpdateDomainActionEventRequest request) {
        DomainActionEventJpaEntity row = findBinding(externalId);
        if (request.getEventType() != null) {
            row.setEventType(requireText(request.getEventType(), "eventType").toUpperCase(Locale.ROOT));
        }
        if (request.getContextProfile() != null) {
            row.setContextProfile(normalizeProfile(request.getContextProfile()));
        }
        if (request.getActorRoleFilter() != null) {
            row.setActorRoleFilter(blankToNull(request.getActorRoleFilter()));
        }
        if (request.getResponseRoleField() != null) {
            row.setResponseRoleField(blankToNull(request.getResponseRoleField()));
        }
        if (request.getResponseRoleValue() != null) {
            row.setResponseRoleValue(blankToNull(request.getResponseRoleValue()));
        }
        if (request.getEnabled() != null) {
            row.setEnabled(request.getEnabled());
        }
        return toResponse(repository.save(row));
    }

    @Transactional
    public void deleteBinding(UUID externalId) {
        DomainActionEventJpaEntity row = findBinding(externalId);
        row.setDeleted(true);
        repository.save(row);
    }

    private DomainActionEventJpaEntity findBinding(UUID externalId) {
        if (externalId == null) {
            throw new IllegalArgumentException("DOMAIN_ACTION_EVENT_BINDING_ID_REQUIRED");
        }
        return repository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("Domain action binding not found"));
    }

    private DomainActionEventResponse toResponse(DomainActionEventJpaEntity row) {
        return new DomainActionEventResponse(
                row.getExternalId(),
                row.getHttpMethod(),
                row.getEndpointPattern(),
                row.getEventType(),
                row.getContextProfile(),
                row.getActorRoleFilter(),
                row.getResponseRoleField(),
                row.getResponseRoleValue(),
                row.isEnabled()
        );
    }

    private static String normalizeProfile(String profile) {
        String normalized = requireText(profile, "contextProfile").toUpperCase(Locale.ROOT);
        if (!ALLOWED_PROFILES.contains(normalized)) {
            throw new IllegalArgumentException("DOMAIN_ACTION_EVENT_CONTEXT_PROFILE_INVALID");
        }
        return normalized;
    }

    private static String normalizeEndpointPattern(String endpointPattern) {
        String pattern = endpointPattern.trim();
        if (!pattern.startsWith("/")) {
            pattern = "/" + pattern;
        }
        return pattern;
    }

    private static String requireText(String value, String fieldName) {
        String trimmed = Objects.toString(value, "").trim();
        if (trimmed.isBlank()) {
            throw new IllegalArgumentException("DOMAIN_ACTION_EVENT_FIELD_REQUIRED");
        }
        return trimmed;
    }

    private static String blankToNull(String value) {
        String trimmed = Objects.toString(value, "").trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private static boolean matchesQuery(DomainActionEventJpaEntity row, DomainActionEventQueryDto query) {
        if (query == null) {
            return true;
        }
        String httpMethod = query.getHttpMethod();
        if (httpMethod != null && !httpMethod.isBlank()
                && !row.getHttpMethod().equalsIgnoreCase(httpMethod.trim())) {
            return false;
        }
        String endpointPattern = query.getEndpointPattern();
        if (endpointPattern != null && !endpointPattern.isBlank()
                && !row.getEndpointPattern().equalsIgnoreCase(endpointPattern.trim())) {
            return false;
        }
        String eventType = query.getEventType();
        if (eventType != null && !eventType.isBlank()
                && !row.getEventType().equalsIgnoreCase(eventType.trim())) {
            return false;
        }
        Boolean enabled = query.getEnabled();
        return enabled == null || row.isEnabled() == enabled;
    }
}
