package com.flexshell.auth;

public enum RoleRequestStatus {
    ACTIVE,
    PENDING_APPROVAL,
    REJECTED,
    /** Self-service deactivation or admin suspension; user cannot sign in until reactivated. */
    INACTIVE
}
