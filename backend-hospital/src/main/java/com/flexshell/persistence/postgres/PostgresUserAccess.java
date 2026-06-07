package com.flexshell.persistence.postgres;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.persistence.UserEntityMapper;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
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
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresUserAccess implements UserAccess {

    private final UserJpaRepository userJpaRepository;

    public PostgresUserAccess(UserJpaRepository userJpaRepository) {
        this.userJpaRepository = userJpaRepository;
    }

    @Override
    public Optional<UserEntity> findById(String id) {
        return userJpaRepository.findById(id)
                .filter(u -> !u.isDeleted())
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public UserEntity save(UserEntity entity) {
        Optional<UserJpaEntity> existing = Optional.empty();
        String id = entity.getId();
        if (id != null && !id.isBlank()) {
            existing = userJpaRepository.findById(id);
        }
        UserJpaEntity saved = userJpaRepository.save(UserEntityMapper.toJpa(entity, existing.orElse(null)));
        return UserEntityMapper.fromJpa(saved);
    }

    @Override
    public Optional<UserEntity> findByUsername(String username) {
        return userJpaRepository.findByUsername(username)
                .filter(u -> !u.isDeleted())
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public Optional<UserEntity> findByEmail(String email) {
        return userJpaRepository.findByEmail(email)
                .filter(u -> !u.isDeleted())
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public Optional<UserEntity> findByEmailIgnoreCase(String email) {
        return userJpaRepository.findByEmailIgnoreCase(email)
                .filter(u -> !u.isDeleted())
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public Optional<UserEntity> findByObjectId(ObjectId objectId) {
        if (objectId == null) {
            return Optional.empty();
        }
        return findById(objectId.toHexString());
    }

    @Override
    public long countByRole(UserRole role) {
        return userJpaRepository.countByRole(role);
    }

    @Override
    public Page<UserEntity> findByRoleStatus(RoleRequestStatus roleStatus, Pageable pageable) {
        return userJpaRepository
                .findByRoleStatusAndDeletedFalseAndRequestedRoleIsNotNull(roleStatus, pageable)
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public Page<UserEntity> findByRole(UserRole role, Pageable pageable) {
        return userJpaRepository.findByRole(role, pageable).map(UserEntityMapper::fromJpa);
    }

    @Override
    public Page<UserEntity> findActiveDoctorsByDepartments(
            UserRole role,
            RoleRequestStatus roleStatus,
            List<String> departmentKeysLower,
            Pageable pageable
    ) {
        return userJpaRepository
                .findActiveDoctorsByDepartments(role.name(), roleStatus.name(), departmentKeysLower, pageable)
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public Page<UserEntity> findActiveDoctorsAllRoles(UserRole role, RoleRequestStatus roleStatus, Pageable pageable) {
        return userJpaRepository
                .findActiveDoctorsAllRoles(role.name(), roleStatus.name(), pageable)
                .map(UserEntityMapper::fromJpa);
    }

    @Override
    public Page<UserEntity> searchUsers(String query, UserRole roleFilter, Pageable pageable) {
        String queryPattern = toIlikePattern(query);
        String roleParam = roleFilter == null ? null : roleFilter.name();
        return userJpaRepository
                .searchNonDeletedUsers(queryPattern, roleParam, pageable)
                .map(UserEntityMapper::fromJpa);
    }

    private static String toIlikePattern(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        String escaped = query.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
