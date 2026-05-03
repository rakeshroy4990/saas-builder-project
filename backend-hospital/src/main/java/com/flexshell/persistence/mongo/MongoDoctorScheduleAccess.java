package com.flexshell.persistence.mongo;

import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.doctorschedule.DoctorScheduleRepository;
import com.flexshell.persistence.api.DoctorScheduleAccess;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.mongo.enabled", havingValue = "true")
@ConditionalOnBean(DoctorScheduleRepository.class)
public class MongoDoctorScheduleAccess implements DoctorScheduleAccess {

    private final DoctorScheduleRepository delegate;

    public MongoDoctorScheduleAccess(DoctorScheduleRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Optional<DoctorScheduleEntity> findByDoctorId(String doctorId) {
        return delegate.findByDoctorId(doctorId);
    }

    @Override
    public DoctorScheduleEntity save(DoctorScheduleEntity entity) {
        return delegate.save(entity);
    }
}
