package com.flexshell.service;

import com.flexshell.controller.dto.MedicalDepartmentMessageRequest;
import com.flexshell.controller.dto.MedicalDepartmentQueryDto;
import com.flexshell.controller.dto.MedicalDepartmentRequest;
import com.flexshell.controller.dto.MedicalDepartmentResponse;
import com.flexshell.controller.dto.PagedMedicalDepartmentListDto;
import com.flexshell.controller.support.EntityQuerySupport;
import com.flexshell.medicaldepartment.MedicalDepartmentEntity;
import com.flexshell.medicaldepartment.MedicalDepartmentLocaleCatalog;
import com.flexshell.persistence.api.MedicalDepartmentAccess;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class MedicalDepartmentService {
    private final ObjectProvider<MedicalDepartmentAccess> departmentAccessProvider;
    private final ObjectProvider<MedicalDepartmentLocaleCatalog> localeCatalogProvider;

    public MedicalDepartmentService(
            ObjectProvider<MedicalDepartmentAccess> departmentAccessProvider,
            ObjectProvider<MedicalDepartmentLocaleCatalog> localeCatalogProvider
    ) {
        this.departmentAccessProvider = departmentAccessProvider;
        this.localeCatalogProvider = localeCatalogProvider;
    }

    public MedicalDepartmentResponse create(MedicalDepartmentRequest request, String locale) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        String code = normalizeCode(request.getCode());
        if (code.isBlank()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_CODE_REQUIRED");
        }
        if (repository.findByCodeIgnoreCase(code).isPresent()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_CODE_EXISTS");
        }
        MedicalDepartmentEntity entity = new MedicalDepartmentEntity();
        apply(entity, request);
        Instant now = Instant.now();
        entity.setCreatedTimestamp(now);
        entity.setUpdatedTimestamp(now);
        MedicalDepartmentEntity saved = repository.save(entity);
        persistLocaleMessages(saved.getId(), request);
        syncEnglishColumns(saved, request);
        saved = repository.save(saved);
        return toResponse(saved, locale);
    }

    public MedicalDepartmentResponse update(String id, MedicalDepartmentRequest request, String locale) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        MedicalDepartmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        String code = normalizeCode(request.getCode());
        if (!code.isBlank() && !code.equalsIgnoreCase(entity.getCode())) {
            repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
                if (!existing.getId().equals(entity.getId())) {
                    throw new IllegalArgumentException("MEDICAL_DEPARTMENT_CODE_EXISTS");
                }
            });
        }
        apply(entity, request);
        entity.setUpdatedTimestamp(Instant.now());
        MedicalDepartmentEntity saved = repository.save(entity);
        persistLocaleMessages(saved.getId(), request);
        syncEnglishColumns(saved, request);
        saved = repository.save(saved);
        return toResponse(saved, locale);
    }

    public MedicalDepartmentResponse createOrUpdate(MedicalDepartmentRequest request, String locale) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        String id = request.getId() == null ? "" : request.getId().trim();
        if (!id.isBlank()) {
            return update(id, request, locale);
        }
        String code = normalizeCode(request.getCode());
        if (!code.isBlank()) {
            return repository.findByCodeIgnoreCase(code)
                    .map(existing -> {
                        request.setId(existing.getId());
                        return update(existing.getId(), request, locale);
                    })
                    .orElseGet(() -> create(request, locale));
        }
        return create(request, locale);
    }

    public boolean delete(String id) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        if (!repository.existsById(id)) {
            return false;
        }
        repository.deleteById(id);
        return true;
    }

    public MedicalDepartmentResponse getById(String id, String locale) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        return repository.findById(id)
                .map(entity -> toResponse(entity, locale))
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
    }

    public List<MedicalDepartmentResponse> getAll(int page, int size, String locale) {
        return listPaged(page, size, new MedicalDepartmentQueryDto(), locale).getContent();
    }

    /**
     * Business key: department {@code id} (String) or {@code code} (case-insensitive).
     */
    public PagedMedicalDepartmentListDto listPaged(int page, int size, MedicalDepartmentQueryDto query, String locale) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        int safePage = EntityQuerySupport.safePage(page);
        int safeSize = EntityQuerySupport.safeSize(size);
        List<MedicalDepartmentEntity> filtered = repository.findAll(PageRequest.of(0, Integer.MAX_VALUE))
                .stream()
                .filter(entity -> matchesQuery(entity, query))
                .toList();
        int total = filtered.size();
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        List<MedicalDepartmentResponse> content = filtered.subList(from, to).stream()
                .map(entity -> toResponse(entity, locale))
                .toList();
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new PagedMedicalDepartmentListDto(content, total, totalPages, safePage, safeSize);
    }

    public boolean deleteByBusinessKey(String businessKey) {
        String id = resolveBusinessKey(businessKey);
        return delete(id);
    }

    private String resolveBusinessKey(String businessKey) {
        String key = businessKey == null ? "" : businessKey.trim();
        if (key.isBlank()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_BUSINESS_KEY_REQUIRED");
        }
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        if (repository.existsById(key)) {
            return key;
        }
        return repository.findByCodeIgnoreCase(key.toUpperCase(Locale.ROOT))
                .map(MedicalDepartmentEntity::getId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
    }

    private static boolean matchesQuery(MedicalDepartmentEntity entity, MedicalDepartmentQueryDto query) {
        if (query == null) {
            return true;
        }
        String code = query.getCode();
        if (code != null && !code.isBlank()
                && !entity.getCode().equalsIgnoreCase(code.trim())) {
            return false;
        }
        String name = query.getName();
        if (name != null && !name.isBlank()
                && (entity.getName() == null || !entity.getName().toLowerCase(Locale.ROOT)
                .contains(name.trim().toLowerCase(Locale.ROOT)))) {
            return false;
        }
        Boolean active = query.getActive();
        if (active != null && entity.isActive() != active) {
            return false;
        }
        return true;
    }

    private void persistLocaleMessages(String departmentId, MedicalDepartmentRequest request) {
        MedicalDepartmentLocaleCatalog catalog = localeCatalogProvider.getIfAvailable();
        if (catalog == null) {
            return;
        }
        List<MedicalDepartmentMessageRequest> messages = MedicalDepartmentLocaleCatalog.effectiveMessages(request);
        catalog.upsertMessages(departmentId, messages);
    }

    private void syncEnglishColumns(MedicalDepartmentEntity entity, MedicalDepartmentRequest request) {
        List<MedicalDepartmentMessageRequest> messages = MedicalDepartmentLocaleCatalog.effectiveMessages(request);
        entity.setName(MedicalDepartmentLocaleCatalog.primaryNameFromMessages(messages, entity.getName()));
        entity.setDescription(MedicalDepartmentLocaleCatalog.primaryDescriptionFromMessages(
                messages,
                entity.getDescription()
        ));
    }

    private void apply(MedicalDepartmentEntity entity, MedicalDepartmentRequest request) {
        List<MedicalDepartmentMessageRequest> messages = MedicalDepartmentLocaleCatalog.effectiveMessages(request);
        String name = MedicalDepartmentLocaleCatalog.primaryNameFromMessages(messages, normalize(request.getName()));
        String code = normalizeCode(request.getCode());
        if (name.isBlank()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_NAME_REQUIRED");
        }
        if (code.isBlank()) {
            throw new IllegalArgumentException("MEDICAL_DEPARTMENT_CODE_REQUIRED");
        }
        entity.setName(name);
        entity.setCode(code);
        entity.setDescription(MedicalDepartmentLocaleCatalog.primaryDescriptionFromMessages(
                messages,
                normalize(request.getDescription())
        ));
        entity.setActive(request.getActive() == null || request.getActive());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeCode(String value) {
        String normalized = normalize(value);
        return normalized.toUpperCase();
    }

    private MedicalDepartmentResponse toResponse(MedicalDepartmentEntity entity, String locale) {
        String name = entity.getName();
        String description = entity.getDescription();
        MedicalDepartmentLocaleCatalog catalog = localeCatalogProvider.getIfAvailable();
        if (catalog != null) {
            MedicalDepartmentLocaleCatalog.ResolvedCopy resolved = catalog.resolve(
                    entity.getId(),
                    locale,
                    entity.getName(),
                    entity.getDescription()
            );
            name = resolved.name();
            description = resolved.description();
        }
        return new MedicalDepartmentResponse(
                entity.getId(),
                name,
                entity.getCode(),
                description,
                entity.isActive(),
                entity.getCreatedTimestamp() == null ? null : entity.getCreatedTimestamp().toString(),
                entity.getUpdatedTimestamp() == null ? null : entity.getUpdatedTimestamp().toString());
    }

    private MedicalDepartmentAccess requireDepartmentAccess() {
        MedicalDepartmentAccess access = departmentAccessProvider.getIfAvailable();
        if (access == null) {
            throw new IllegalStateException("Medical department persistence is unavailable");
        }
        return access;
    }
}
