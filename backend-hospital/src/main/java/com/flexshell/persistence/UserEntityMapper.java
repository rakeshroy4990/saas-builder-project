package com.flexshell.persistence;

import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;

import java.util.UUID;

public final class UserEntityMapper {

    private UserEntityMapper() {
    }

    public static UserEntity fromJpa(UserJpaEntity j) {
        if (j == null) {
            return null;
        }
        UserEntity e = new UserEntity();
        e.setId(j.getId());
        e.setUsername(j.getUsername());
        e.setEmail(j.getEmail());
        e.setFirstName(j.getFirstName());
        e.setLastName(j.getLastName());
        e.setPasswordHash(j.getPasswordHash());
        e.setAddress(j.getAddress());
        e.setGender(j.getGender());
        e.setMobileNumber(j.getMobileNumber());
        e.setDepartment(j.getDepartment());
        e.setQualifications(j.getQualifications());
        e.setSmcName(j.getSmcName());
        e.setSmcRegistrationNumber(j.getSmcRegistrationNumber());
        e.setCreatedTimestamp(j.getCreatedAt());
        e.setUpdatedTimestamp(j.getUpdatedAt());
        e.setActive(j.isActive());
        e.setTokenVersion(j.getTokenVersion());
        e.setRole(j.getRole());
        e.setRoleStatus(j.getRoleStatus());
        e.setRequestedRole(j.getRequestedRole());
        e.setRoleRequestedAt(j.getRoleRequestedAt());
        e.setRoleDecisionAt(j.getRoleDecisionAt());
        e.setRoleDecisionBy(j.getRoleDecisionBy());
        e.setRoleRejectedReason(j.getRoleRejectedReason());
        return e;
    }

    public static UserJpaEntity toJpa(UserEntity e, UserJpaEntity existing) {
        UserJpaEntity j = existing != null ? existing : new UserJpaEntity();
        if (j.getExternalId() == null) {
            j.setExternalId(UUID.randomUUID());
        }
        j.setId(e.getId());
        j.setUsername(e.getUsername());
        j.setEmail(e.getEmail());
        j.setFirstName(e.getFirstName());
        j.setLastName(e.getLastName());
        j.setPasswordHash(e.getPasswordHash());
        j.setAddress(e.getAddress());
        j.setGender(e.getGender());
        j.setMobileNumber(e.getMobileNumber());
        j.setDepartment(e.getDepartment());
        j.setQualifications(e.getQualifications());
        j.setSmcName(e.getSmcName());
        j.setSmcRegistrationNumber(e.getSmcRegistrationNumber());
        j.setCreatedAt(e.getCreatedTimestamp());
        j.setUpdatedAt(e.getUpdatedTimestamp());
        j.setActive(e.isActive());
        j.setTokenVersion(e.getTokenVersion());
        j.setRole(e.getRole());
        j.setRoleStatus(e.getRoleStatus());
        j.setRequestedRole(e.getRequestedRole());
        j.setRoleRequestedAt(e.getRoleRequestedAt());
        j.setRoleDecisionAt(e.getRoleDecisionAt());
        j.setRoleDecisionBy(e.getRoleDecisionBy());
        j.setRoleRejectedReason(e.getRoleRejectedReason());
        j.setDeleted(false);
        return j;
    }
}
