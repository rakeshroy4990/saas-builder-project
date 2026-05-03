package com.flexshell.persistence.postgres;

import com.flexshell.medicaldepartment.MedicalDepartmentEntity;
import com.flexshell.persistence.api.MedicalDepartmentAccess;
import com.flexshell.persistence.postgres.model.MedicalDepartmentJpaEntity;
import com.flexshell.persistence.postgres.repository.MedicalDepartmentJpaRepository;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresMedicalDepartmentAccess implements MedicalDepartmentAccess {

    private final MedicalDepartmentJpaRepository jpaRepository;

    public PostgresMedicalDepartmentAccess(MedicalDepartmentJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<MedicalDepartmentEntity> findById(String id) {
        return jpaRepository.findByIdAndDeletedFalse(id).map(this::toDomain);
    }

    @Override
    public Optional<MedicalDepartmentEntity> findByCodeIgnoreCase(String code) {
        return jpaRepository.findByCodeIgnoreCaseAndDeletedFalse(code).map(this::toDomain);
    }

    @Override
    public MedicalDepartmentEntity save(MedicalDepartmentEntity entity) {
        Optional<MedicalDepartmentJpaEntity> existing = Optional.empty();
        if (entity.getId() != null && !entity.getId().isBlank()) {
            existing = jpaRepository.findById(entity.getId()).filter(e -> !e.isDeleted());
        }
        MedicalDepartmentJpaEntity row = toJpa(entity, existing.orElse(null));
        MedicalDepartmentJpaEntity saved = jpaRepository.save(row);
        return toDomain(saved);
    }

    @Override
    public void deleteById(String id) {
        jpaRepository.findById(id).ifPresent(jpaRepository::delete);
    }

    @Override
    public boolean existsById(String id) {
        return jpaRepository.existsByIdAndDeletedFalse(id);
    }

    @Override
    public Page<MedicalDepartmentEntity> findAll(Pageable pageable) {
        return jpaRepository.findAllByDeletedFalse(pageable).map(this::toDomain);
    }

    private MedicalDepartmentEntity toDomain(MedicalDepartmentJpaEntity j) {
        MedicalDepartmentEntity e = new MedicalDepartmentEntity();
        e.setId(j.getId());
        e.setName(j.getName());
        e.setCode(j.getCode());
        e.setDescription(j.getDescription());
        e.setActive(j.isActive());
        e.setCreatedTimestamp(j.getCreatedAt());
        e.setUpdatedTimestamp(j.getUpdatedAt());
        return e;
    }

    private MedicalDepartmentJpaEntity toJpa(MedicalDepartmentEntity d, MedicalDepartmentJpaEntity existing) {
        MedicalDepartmentJpaEntity row = existing != null ? existing : new MedicalDepartmentJpaEntity();
        if (existing == null) {
            if (d.getId() != null && !d.getId().isBlank()) {
                row.setId(d.getId());
            } else {
                row.setId(new ObjectId().toHexString());
            }
        }
        row.setName(d.getName());
        row.setCode(d.getCode());
        row.setDescription(d.getDescription());
        row.setActive(d.isActive());
        row.setCreatedAt(d.getCreatedTimestamp());
        row.setUpdatedAt(d.getUpdatedTimestamp());
        row.setDeleted(false);
        return row;
    }
}
