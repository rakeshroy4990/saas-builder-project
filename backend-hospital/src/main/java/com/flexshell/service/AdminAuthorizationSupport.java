package com.flexshell.service;

import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;

/**
 * Shared admin checks for management APIs.
 */
public final class AdminAuthorizationSupport {

    private AdminAuthorizationSupport() {
    }

    public static UserEntity requireAdminUser(UserRepository userRepository, String actorUserId) {
        if (userRepository == null) {
            throw new IllegalStateException("User repository unavailable");
        }
        String id = actorUserId == null ? "" : actorUserId.trim();
        if (id.isEmpty()) {
            throw new SecurityException("Authentication required");
        }
        UserEntity actor = userRepository.findById(id).orElseThrow(() -> new SecurityException("User not found"));
        if (actor.getRole() != UserRole.ADMIN) {
            throw new SecurityException("Admin access required");
        }
        return actor;
    }
}
