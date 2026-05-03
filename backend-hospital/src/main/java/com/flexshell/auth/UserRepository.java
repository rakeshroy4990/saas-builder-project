package com.flexshell.auth;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<UserEntity, String> {
    Optional<UserEntity> findByUsername(String username);

    Optional<UserEntity> findByEmail(String email);

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    @Query("{ '_id': ?0 }")
    Optional<UserEntity> findByObjectId(ObjectId objectId);

    long countByRole(UserRole role);

    Page<UserEntity> findByRoleStatus(RoleRequestStatus roleStatus, Pageable pageable);

    Page<UserEntity> findByRole(UserRole role, Pageable pageable);

    Page<UserEntity> findByRoleAndRoleStatusAndDepartmentIgnoreCaseAndActiveTrue(
            UserRole role,
            RoleRequestStatus roleStatus,
            String department,
            Pageable pageable
    );

    /**
     * {@code ?2} is a BSON array of department strings compared case-insensitively to {@code Department}
     * (e.g. UI may send a department code while users store the full name, or casing may differ).
     */
    @Query("{ " +
            "'Role': ?0, " +
            "'$and': [" +
            "  { '$or': [ { 'RoleStatus': ?1 }, { 'RoleStatus': null }, { 'RoleStatus': { '$exists': false } } ] }, " +
            "  { '$or': [ { 'Active': true }, { 'Active': null }, { 'Active': { '$exists': false } } ] }," +
            "  { $expr: { $in: [ { $toLower: { $ifNull: [ '$Department', '' ] } }, ?2 ] } }" +
            "]" +
            "}")
    Page<UserEntity> findActiveDoctorsByDepartments(
            UserRole role,
            RoleRequestStatus roleStatus,
            List<String> departmentKeysLower,
            Pageable pageable
    );

    @Query("{ 'Role': ?0, '$and': [ " +
            "{ '$or': [ { 'RoleStatus': ?1 }, { 'RoleStatus': null }, { 'RoleStatus': { '$exists': false } } ] }, " +
            "{ '$or': [ { 'Active': true }, { 'Active': null }, { 'Active': { '$exists': false } } ] } " +
            "] }")
    Page<UserEntity> findActiveDoctorsAllRoles(UserRole role, RoleRequestStatus roleStatus, Pageable pageable);
}

