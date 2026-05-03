package com.flexshell.persistence.mongo;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.appointment.AppointmentRepository;
import com.flexshell.persistence.api.AppointmentAccess;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.mongo.enabled", havingValue = "true")
@ConditionalOnBean(AppointmentRepository.class)
public class MongoAppointmentAccess implements AppointmentAccess {

    private final AppointmentRepository delegate;

    public MongoAppointmentAccess(AppointmentRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Optional<AppointmentEntity> findById(String id) {
        return delegate.findById(id);
    }

    @Override
    public AppointmentEntity save(AppointmentEntity entity) {
        return delegate.save(entity);
    }

    @Override
    public void deleteById(String id) {
        delegate.deleteById(id);
    }

    @Override
    public Page<AppointmentEntity> findByDoctorId(String doctorId, Pageable pageable) {
        return delegate.findByDoctorId(doctorId, pageable);
    }

    @Override
    public Page<AppointmentEntity> findByCreatedBy(String createdBy, Pageable pageable) {
        return delegate.findByCreatedBy(createdBy, pageable);
    }

    @Override
    public Page<AppointmentEntity> findAll(Pageable pageable) {
        return delegate.findAll(pageable);
    }

    @Override
    public List<AppointmentEntity> findByDoctorIdAndPreferredDate(String doctorId, String preferredDate) {
        return delegate.findByDoctorIdAndPreferredDate(doctorId, preferredDate);
    }
}
