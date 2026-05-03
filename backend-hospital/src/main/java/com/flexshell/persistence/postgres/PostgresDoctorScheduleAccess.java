package com.flexshell.persistence.postgres;

import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.persistence.api.DoctorScheduleAccess;
import com.flexshell.persistence.postgres.model.DoctorScheduleJpaEntity;
import com.flexshell.persistence.postgres.repository.DoctorScheduleJpaRepository;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
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
