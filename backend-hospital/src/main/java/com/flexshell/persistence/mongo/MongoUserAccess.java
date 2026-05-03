package com.flexshell.persistence.mongo;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.persistence.api.UserAccess;
import org.bson.types.ObjectId;
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
public class MongoUserAccess implements UserAccess {

    private final UserRepository userRepository;

    public MongoUserAccess(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public Optional<UserEntity> findById(String id) {
        return userRepository.findById(id);
    }

    @Override
    public UserEntity save(UserEntity entity) {
        return userRepository.save(entity);
    }

    @Override
    public Optional<UserEntity> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Override
    public Optional<UserEntity> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    @Override
    public Optional<UserEntity> findByEmailIgnoreCase(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    @Override
    public Optional<UserEntity> findByObjectId(ObjectId objectId) {
        return userRepository.findByObjectId(objectId);
    }

    @Override
    public long countByRole(UserRole role) {
        return userRepository.countByRole(role);
    }

    @Override
    public Page<UserEntity> findByRoleStatus(RoleRequestStatus roleStatus, Pageable pageable) {
        return userRepository.findByRoleStatus(roleStatus, pageable);
    }

    @Override
    public Page<UserEntity> findByRole(UserRole role, Pageable pageable) {
        return userRepository.findByRole(role, pageable);
    }

    @Override
    public Page<UserEntity> findActiveDoctorsByDepartments(
            UserRole role,
            RoleRequestStatus roleStatus,
            List<String> departmentKeysLower,
            Pageable pageable
    ) {
        return userRepository.findActiveDoctorsByDepartments(role, roleStatus, departmentKeysLower, pageable);
    }

    @Override
    public Page<UserEntity> findActiveDoctorsAllRoles(UserRole role, RoleRequestStatus roleStatus, Pageable pageable) {
        return userRepository.findActiveDoctorsAllRoles(role, roleStatus, pageable);
    }
}
