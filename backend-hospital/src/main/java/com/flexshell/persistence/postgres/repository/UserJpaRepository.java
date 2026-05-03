package com.flexshell.persistence.postgres.repository;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserRole;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<UserJpaEntity, String> {

    Optional<UserJpaEntity> findByUsername(String username);

    Optional<UserJpaEntity> findByEmail(String email);

    Optional<UserJpaEntity> findByEmailIgnoreCase(String email);

    long countByRole(UserRole role);

    Page<UserJpaEntity> findByRoleStatus(RoleRequestStatus roleStatus, Pageable pageable);

    Page<UserJpaEntity> findByRole(UserRole role, Pageable pageable);

    @Query(
            value = """
                    SELECT * FROM users u
                    WHERE u.deleted = false
                      AND u.role = :role
                      AND (u.role_status = :roleStatus OR u.role_status IS NULL)
                      AND (u.active = true OR u.active IS NULL)
                      AND lower(trim(coalesce(u.department, ''))) IN (:deptKeys)
                    """,
            countQuery = """
                    SELECT count(*) FROM users u
                    WHERE u.deleted = false
                      AND u.role = :role
                      AND (u.role_status = :roleStatus OR u.role_status IS NULL)
                      AND (u.active = true OR u.active IS NULL)
                      AND lower(trim(coalesce(u.department, ''))) IN (:deptKeys)
                    """,
            nativeQuery = true)
    Page<UserJpaEntity> findActiveDoctorsByDepartments(
            @Param("role") String role,
            @Param("roleStatus") String roleStatus,
            @Param("deptKeys") List<String> deptKeys,
            Pageable pageable);

    @Query(
            value = """
                    SELECT * FROM users u
                    WHERE u.deleted = false
                      AND u.role = :role
                      AND (u.role_status = :roleStatus OR u.role_status IS NULL)
                      AND (u.active = true OR u.active IS NULL)
                    """,
            countQuery = """
                    SELECT count(*) FROM users u
                    WHERE u.deleted = false
                      AND u.role = :role
                      AND (u.role_status = :roleStatus OR u.role_status IS NULL)
                      AND (u.active = true OR u.active IS NULL)
                    """,
            nativeQuery = true)
    Page<UserJpaEntity> findActiveDoctorsAllRoles(
            @Param("role") String role,
            @Param("roleStatus") String roleStatus,
            Pageable pageable);
}
