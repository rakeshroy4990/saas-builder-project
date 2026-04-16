package com.flexshell.controller.dto;

import com.flexshell.auth.UserEntity;

import java.time.Instant;

public record RoleRequestSummary(
        String userId,
        String email,
        String firstName,
        String lastName,
        String role,
        String roleStatus,
        String requestedRole,
        Instant requestedAt,
        String roleDecisionBy,
        Instant roleDecisionAt,
        String roleRejectedReason
) {
    public static RoleRequestSummary fromUser(UserEntity user) {
        return new RoleRequestSummary(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole() == null ? null : user.getRole().name(),
                user.getRoleStatus() == null ? null : user.getRoleStatus().name(),
                user.getRequestedRole() == null ? null : user.getRequestedRole().name(),
                user.getRoleRequestedAt(),
                user.getRoleDecisionBy(),
                user.getRoleDecisionAt(),
                user.getRoleRejectedReason());
    }
}
