package com.flexshell.persistence.mongo;

import com.flexshell.medicaldepartment.MedicalDepartmentEntity;
import com.flexshell.medicaldepartment.MedicalDepartmentRepository;
import com.flexshell.persistence.api.MedicalDepartmentAccess;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.mongo.enabled", havingValue = "true")
@ConditionalOnBean(MedicalDepartmentRepository.class)
public class MongoMedicalDepartmentAccess implements MedicalDepartmentAccess {

    private final MedicalDepartmentRepository delegate;

    public MongoMedicalDepartmentAccess(MedicalDepartmentRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Optional<MedicalDepartmentEntity> findById(String id) {
        return delegate.findById(id);
    }

    @Override
    public Optional<MedicalDepartmentEntity> findByCodeIgnoreCase(String code) {
        return delegate.findByCodeIgnoreCase(code);
    }

    @Override
    public MedicalDepartmentEntity save(MedicalDepartmentEntity entity) {
        return delegate.save(entity);
    }

    @Override
    public void deleteById(String id) {
        delegate.deleteById(id);
    }

    @Override
    public boolean existsById(String id) {
        return delegate.existsById(id);
    }

    @Override
    public Page<MedicalDepartmentEntity> findAll(Pageable pageable) {
        return delegate.findAll(pageable);
    }
}
