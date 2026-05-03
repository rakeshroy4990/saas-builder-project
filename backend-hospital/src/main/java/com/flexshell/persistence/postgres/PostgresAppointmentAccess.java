package com.flexshell.persistence.postgres;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.persistence.api.AppointmentAccess;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresAppointmentAccess implements AppointmentAccess {

    private final AppointmentJpaRepository jpaRepository;
    private final AppointmentEntityMapper mapper;

    public PostgresAppointmentAccess(AppointmentJpaRepository jpaRepository, AppointmentEntityMapper mapper) {
        this.jpaRepository = jpaRepository;
        this.mapper = mapper;
    }

    @Override
    public Optional<AppointmentEntity> findById(String id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    public AppointmentEntity save(AppointmentEntity entity) {
        if (entity.getId() == null || entity.getId().isBlank()) {
            entity.setId(new ObjectId().toHexString());
        }
        Optional<AppointmentJpaEntity> existing = jpaRepository.findById(entity.getId());
        AppointmentJpaEntity row = mapper.toJpa(entity, existing.orElse(null));
        if (existing.isPresent()) {
            row.setExternalId(existing.get().getExternalId());
        }
        AppointmentJpaEntity saved = jpaRepository.save(row);
        return mapper.toDomain(saved);
    }

    @Override
    public void deleteById(String id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public Page<AppointmentEntity> findByDoctorId(String doctorId, Pageable pageable) {
        return jpaRepository.findByDoctorIdAndDeletedFalse(doctorId, pageable).map(mapper::toDomain);
    }

    @Override
    public Page<AppointmentEntity> findByCreatedBy(String createdBy, Pageable pageable) {
        return jpaRepository.findByCreatedByAndDeletedFalse(createdBy, pageable).map(mapper::toDomain);
    }

    @Override
    public Page<AppointmentEntity> findAll(Pageable pageable) {
        return jpaRepository.findAll(pageable).map(mapper::toDomain);
    }

    @Override
    public List<AppointmentEntity> findByDoctorIdAndPreferredDate(String doctorId, String preferredDate) {
        return jpaRepository.findByDoctorIdAndPreferredDateAndDeletedFalse(doctorId, preferredDate).stream()
                .map(mapper::toDomain)
                .collect(Collectors.toList());
    }
}
