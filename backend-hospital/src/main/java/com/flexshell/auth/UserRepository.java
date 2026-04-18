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

    @Query("{ '_id': ?0 }")
    Optional<UserEntity> findByObjectId(ObjectId objectId);

    long countByRole(UserRole role);

    Page<UserEntity> findByRoleStatus(RoleRequestStatus roleStatus, Pageable pageable);

    Page<UserEntity> findByRoleAndRoleStatusAndDepartmentIgnoreCaseAndActiveTrue(
            UserRole role,
            RoleRequestStatus roleStatus,
            String department,
            Pageable pageable
    );

    @Query("{ " +
            "'Role': ?0, " +
            "'Department': { $in: ?2 }, " +
            "'$and': [" +
            "  { '$or': [ { 'RoleStatus': ?1 }, { 'RoleStatus': null }, { 'RoleStatus': { '$exists': false } } ] }, " +
            "  { '$or': [ { 'Active': true }, { 'Active': null }, { 'Active': { '$exists': false } } ] }" +
            "]" +
            "}")
    Page<UserEntity> findActiveDoctorsByDepartments(
            UserRole role,
            RoleRequestStatus roleStatus,
            List<String> departments,
            Pageable pageable
    );

    @Query("{ 'Role': ?0, '$and': [ " +
            "{ '$or': [ { 'RoleStatus': ?1 }, { 'RoleStatus': null }, { 'RoleStatus': { '$exists': false } } ] }, " +
            "{ '$or': [ { 'Active': true }, { 'Active': null }, { 'Active': { '$exists': false } } ] } " +
            "] }")
    Page<UserEntity> findActiveDoctorsAllRoles(UserRole role, RoleRequestStatus roleStatus, Pageable pageable);
}

