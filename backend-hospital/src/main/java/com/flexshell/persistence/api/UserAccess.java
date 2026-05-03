package com.flexshell.persistence.api;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.RoleRequestStatus;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/**
 * Persistence port for {@link UserEntity} — Mongo or PostgreSQL implementations.
 */
public interface UserAccess {

    Optional<UserEntity> findById(String id);

    UserEntity save(UserEntity entity);

    Optional<UserEntity> findByUsername(String username);

    Optional<UserEntity> findByEmail(String email);

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    Optional<UserEntity> findByObjectId(ObjectId objectId);

    long countByRole(UserRole role);

    Page<UserEntity> findByRoleStatus(RoleRequestStatus roleStatus, Pageable pageable);

    Page<UserEntity> findByRole(UserRole role, Pageable pageable);

    Page<UserEntity> findActiveDoctorsByDepartments(
            UserRole role,
            RoleRequestStatus roleStatus,
            List<String> departmentKeysLower,
            Pageable pageable);

    Page<UserEntity> findActiveDoctorsAllRoles(UserRole role, RoleRequestStatus roleStatus, Pageable pageable);
}
