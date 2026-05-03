package com.flexshell.service;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRole;
import com.flexshell.persistence.api.UserAccess;

/**
 * Shared admin checks for management APIs.
 */
public final class AdminAuthorizationSupport {

    private AdminAuthorizationSupport() {
    }

    public static UserEntity requireAdminUser(UserAccess users, String actorUserId) {
        if (users == null) {
            throw new IllegalStateException("User persistence unavailable");
        }
        String id = actorUserId == null ? "" : actorUserId.trim();
        if (id.isEmpty()) {
            throw new SecurityException("Authentication required");
        }
        UserEntity actor = users.findById(id).orElseThrow(() -> new SecurityException("User not found"));
        if (actor.getRole() != UserRole.ADMIN) {
            throw new SecurityException("Admin access required");
        }
        return actor;
    }
}
