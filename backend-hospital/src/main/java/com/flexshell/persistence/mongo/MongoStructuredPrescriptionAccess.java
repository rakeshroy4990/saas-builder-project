package com.flexshell.persistence.mongo;

import com.flexshell.persistence.api.StructuredPrescriptionAccess;
import com.flexshell.prescription.StructuredPrescriptionEntity;
import com.flexshell.prescription.StructuredPrescriptionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.mongo.enabled", havingValue = "true")
@ConditionalOnBean(StructuredPrescriptionRepository.class)
public class MongoStructuredPrescriptionAccess implements StructuredPrescriptionAccess {

    private final StructuredPrescriptionRepository delegate;

    public MongoStructuredPrescriptionAccess(StructuredPrescriptionRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Optional<StructuredPrescriptionEntity> findByAppointmentId(String appointmentId) {
        return delegate.findByAppointmentId(appointmentId);
    }

    @Override
    public StructuredPrescriptionEntity save(StructuredPrescriptionEntity entity) {
        return delegate.save(entity);
    }
}
