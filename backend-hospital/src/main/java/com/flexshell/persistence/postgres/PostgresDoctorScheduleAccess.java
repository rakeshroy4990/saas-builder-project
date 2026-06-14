package com.flexshell.persistence.postgres;

import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.persistence.api.DoctorScheduleAccess;
import com.flexshell.persistence.postgres.model.DoctorScheduleJpaEntity;
import com.flexshell.persistence.postgres.repository.DoctorScheduleJpaRepository;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Optional;

@Service
@Primary
public class PostgresDoctorScheduleAccess implements DoctorScheduleAccess {

    private final DoctorScheduleJpaRepository jpaRepository;

    public PostgresDoctorScheduleAccess(DoctorScheduleJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<DoctorScheduleEntity> findByDoctorId(String doctorId) {
        return jpaRepository.findByDoctorIdAndDeletedFalse(doctorId).map(this::toDomain);
    }

    @Override
    public DoctorScheduleEntity save(DoctorScheduleEntity entity) {
        Optional<DoctorScheduleJpaEntity> byDoctorId = jpaRepository.findByDoctorId(entity.getDoctorId());
        Optional<DoctorScheduleJpaEntity> existing = byDoctorId;
        if (existing.isEmpty() && entity.getId() != null && !entity.getId().isBlank()) {
            existing = jpaRepository.findById(entity.getId());
        }
        DoctorScheduleJpaEntity row = toJpa(entity, existing.orElse(null));
        DoctorScheduleJpaEntity saved = jpaRepository.save(row);
        return toDomain(saved);
    }

    @Override
    public Page<DoctorScheduleEntity> findAll(Pageable pageable) {
        return jpaRepository.findByDeletedFalse(pageable).map(this::toDomain);
    }

    @Override
    public boolean deleteByDoctorId(String doctorId) {
        Optional<DoctorScheduleJpaEntity> row = jpaRepository.findByDoctorIdAndDeletedFalse(doctorId);
        if (row.isEmpty()) {
            return false;
        }
        DoctorScheduleJpaEntity entity = row.get();
        entity.setDeleted(true);
        entity.setUpdatedAt(java.time.Instant.now());
        jpaRepository.save(entity);
        return true;
    }

    private DoctorScheduleEntity toDomain(DoctorScheduleJpaEntity j) {
        DoctorScheduleEntity e = new DoctorScheduleEntity();
        e.setId(j.getId());
        e.setDoctorId(j.getDoctorId());
        e.setWeekly(j.getWeekly() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(j.getWeekly()));
        e.setUpdatedBy(j.getUpdatedBy() == null ? "" : j.getUpdatedBy());
        e.setUpdatedAt(j.getUpdatedAt());
        return e;
    }

    private DoctorScheduleJpaEntity toJpa(DoctorScheduleEntity d, DoctorScheduleJpaEntity existing) {
        DoctorScheduleJpaEntity row = existing != null ? existing : new DoctorScheduleJpaEntity();
        if (existing == null) {
            if (d.getId() != null && !d.getId().isBlank()) {
                row.setId(d.getId());
            } else {
                row.setId(new ObjectId().toHexString());
            }
        }
        row.setDoctorId(d.getDoctorId());
        row.setWeekly(d.getWeekly() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(d.getWeekly()));
        row.setUpdatedBy(d.getUpdatedBy());
        row.setUpdatedAt(d.getUpdatedAt());
        row.setDeleted(false);
        return row;
    }
}
