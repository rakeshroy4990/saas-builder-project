package com.flexshell.service;

import com.flexshell.controller.dto.MedicalDepartmentRequest;
import com.flexshell.controller.dto.MedicalDepartmentResponse;
import com.flexshell.medicaldepartment.MedicalDepartmentEntity;
import com.flexshell.persistence.api.MedicalDepartmentAccess;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class MedicalDepartmentService {
    private final ObjectProvider<MedicalDepartmentAccess> departmentAccessProvider;

    public MedicalDepartmentService(ObjectProvider<MedicalDepartmentAccess> departmentAccessProvider) {
        this.departmentAccessProvider = departmentAccessProvider;
    }

    public MedicalDepartmentResponse create(MedicalDepartmentRequest request) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        String code = normalizeCode(request.getCode());
        if (code.isBlank()) {
            throw new IllegalArgumentException("Code is required");
        }
        if (repository.findByCodeIgnoreCase(code).isPresent()) {
            throw new IllegalArgumentException("Department code already exists");
        }
        MedicalDepartmentEntity entity = new MedicalDepartmentEntity();
        apply(entity, request);
        Instant now = Instant.now();
        entity.setCreatedTimestamp(now);
        entity.setUpdatedTimestamp(now);
        return toResponse(repository.save(entity));
    }

    public MedicalDepartmentResponse update(String id, MedicalDepartmentRequest request) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        MedicalDepartmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        String code = normalizeCode(request.getCode());
        if (!code.isBlank() && !code.equalsIgnoreCase(entity.getCode())) {
            repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
                if (!existing.getId().equals(entity.getId())) {
                    throw new IllegalArgumentException("Department code already exists");
                }
            });
        }
        apply(entity, request);
        entity.setUpdatedTimestamp(Instant.now());
        return toResponse(repository.save(entity));
    }

    public MedicalDepartmentResponse createOrUpdate(MedicalDepartmentRequest request) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        String id = request.getId() == null ? "" : request.getId().trim();
        if (!id.isBlank()) {
            return update(id, request);
        }
        String code = normalizeCode(request.getCode());
        if (!code.isBlank()) {
            return repository.findByCodeIgnoreCase(code)
                    .map(existing -> {
                        request.setId(existing.getId());
                        return update(existing.getId(), request);
                    })
                    .orElseGet(() -> create(request));
        }
        return create(request);
    }

    public boolean delete(String id) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        if (!repository.existsById(id)) {
            return false;
        }
        repository.deleteById(id);
        return true;
    }

    public MedicalDepartmentResponse getById(String id) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        return repository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
    }

    public List<MedicalDepartmentResponse> getAll(int page, int size) {
        MedicalDepartmentAccess repository = requireDepartmentAccess();
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, size);
        return repository.findAll(PageRequest.of(safePage, safeSize))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void apply(MedicalDepartmentEntity entity, MedicalDepartmentRequest request) {
        String name = normalize(request.getName());
        String code = normalizeCode(request.getCode());
        if (name.isBlank()) {
            throw new IllegalArgumentException("Name is required");
        }
        if (code.isBlank()) {
            throw new IllegalArgumentException("Code is required");
        }
        entity.setName(name);
        entity.setCode(code);
        entity.setDescription(normalize(request.getDescription()));
        entity.setActive(request.getActive() == null || request.getActive());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeCode(String value) {
        String normalized = normalize(value);
        return normalized.toUpperCase();
    }

    private MedicalDepartmentResponse toResponse(MedicalDepartmentEntity entity) {
        return new MedicalDepartmentResponse(
                entity.getId(),
                entity.getName(),
                entity.getCode(),
                entity.getDescription(),
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
