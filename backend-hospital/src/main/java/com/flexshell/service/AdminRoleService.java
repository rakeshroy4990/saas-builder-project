package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.RoleRequestSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Privileged self-registration (doctor or admin) is moderated here. Any active hospital admin account
 * authorized for {@code /api/admin/**} may list, approve, or reject pending role requests.
 */
@Service
public class AdminRoleService {
    private static final Logger log = LoggerFactory.getLogger(AdminRoleService.class);
    private final ObjectProvider<UserAccess> userAccessProvider;

    public AdminRoleService(ObjectProvider<UserAccess> userAccessProvider) {
        this.userAccessProvider = userAccessProvider;
    }

    public List<RoleRequestSummary> listPendingRoleRequests(String approverId, int page, int size) {
        UserAccess users = requireRepository();
        AdminAuthorizationSupport.requireAdminUser(users, approverId);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, size);
        return users.findByRoleStatus(RoleRequestStatus.PENDING_APPROVAL, PageRequest.of(safePage, safeSize))
                .stream()
                .map(RoleRequestSummary::fromUser)
                .toList();
    }

    public RoleRequestSummary approveRoleRequest(String targetUserId, String approverId) {
        UserAccess users = requireRepository();
        AdminAuthorizationSupport.requireAdminUser(users, approverId);
        UserEntity targetUser = users.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Role request not found"));
        if (targetUser.getRoleStatus() != RoleRequestStatus.PENDING_APPROVAL || targetUser.getRequestedRole() == null) {
            throw new IllegalArgumentException("Role request is not pending approval");
        }
        targetUser.setRole(targetUser.getRequestedRole());
        targetUser.setRoleStatus(RoleRequestStatus.ACTIVE);
        targetUser.setRoleDecisionAt(Instant.now());
        targetUser.setRoleDecisionBy(approverId);
        targetUser.setRoleRejectedReason(null);
        targetUser.setRequestedRole(null);
        targetUser.setUpdatedTimestamp(Instant.now());
        UserEntity saved = users.save(targetUser);
        log.info("Privileged role approved targetUserId={} approvedBy={} role={}",
                targetUserId, approverId, saved.getRole());
        return RoleRequestSummary.fromUser(saved);
    }

    public RoleRequestSummary rejectRoleRequest(String targetUserId, String approverId, String reason) {
        UserAccess users = requireRepository();
        AdminAuthorizationSupport.requireAdminUser(users, approverId);
        UserEntity targetUser = users.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Role request not found"));
        if (targetUser.getRoleStatus() != RoleRequestStatus.PENDING_APPROVAL || targetUser.getRequestedRole() == null) {
            throw new IllegalArgumentException("Role request is not pending approval");
        }
        targetUser.setRole(UserRole.PATIENT);
        targetUser.setRoleStatus(RoleRequestStatus.REJECTED);
        targetUser.setRoleDecisionAt(Instant.now());
        targetUser.setRoleDecisionBy(approverId);
        targetUser.setRoleRejectedReason(reason == null ? null : reason.trim());
        targetUser.setUpdatedTimestamp(Instant.now());
        UserEntity saved = users.save(targetUser);
        log.info("Privileged role rejected targetUserId={} rejectedBy={} requestedRole={} reason={}",
                targetUserId, approverId, saved.getRequestedRole(), saved.getRoleRejectedReason());
        return RoleRequestSummary.fromUser(saved);
    }

    private UserAccess requireRepository() {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new IllegalStateException("User persistence is unavailable");
        }
        return users;
    }
}
