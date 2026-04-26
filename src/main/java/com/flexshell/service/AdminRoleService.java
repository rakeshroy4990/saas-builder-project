package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.RoleRequestSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class AdminRoleService {
    private static final Logger log = LoggerFactory.getLogger(AdminRoleService.class);
    private final ObjectProvider<UserRepository> userRepositoryProvider;

    public AdminRoleService(ObjectProvider<UserRepository> userRepositoryProvider) {
        this.userRepositoryProvider = userRepositoryProvider;
    }

    public List<RoleRequestSummary> listPendingRoleRequests(String approverId, int page, int size) {
        UserRepository userRepository = requireRepository();
        ensureApproverIsAdmin(approverId);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, size);
        return userRepository.findByRoleStatus(RoleRequestStatus.PENDING_APPROVAL, PageRequest.of(safePage, safeSize))
                .stream()
                .map(RoleRequestSummary::fromUser)
                .toList();
    }

    public RoleRequestSummary approveRoleRequest(String targetUserId, String approverId) {
        UserRepository userRepository = requireRepository();
        ensureApproverIsAdmin(approverId);
        UserEntity targetUser = userRepository.findById(targetUserId)
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
        UserEntity saved = userRepository.save(targetUser);
        log.info("Privileged role approved targetUserId={} approvedBy={} role={}",
                targetUserId, approverId, saved.getRole());
        return RoleRequestSummary.fromUser(saved);
    }

    public RoleRequestSummary rejectRoleRequest(String targetUserId, String approverId, String reason) {
        UserRepository userRepository = requireRepository();
        ensureApproverIsAdmin(approverId);
        UserEntity targetUser = userRepository.findById(targetUserId)
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
        UserEntity saved = userRepository.save(targetUser);
        log.info("Privileged role rejected targetUserId={} rejectedBy={} requestedRole={} reason={}",
                targetUserId, approverId, saved.getRequestedRole(), saved.getRoleRejectedReason());
        return RoleRequestSummary.fromUser(saved);
    }

    private void ensureApproverIsAdmin(String approverId) {
        UserRepository userRepository = requireRepository();
        UserEntity approver = userRepository.findById(approverId)
                .orElseThrow(() -> new SecurityException("Approver not found"));
        if (approver.getRole() != UserRole.ADMIN) {
            log.warn("Unauthorized role moderation attempt userId={} role={}", approverId, approver.getRole());
            throw new SecurityException("Only admin can moderate role requests");
        }
    }

    private UserRepository requireRepository() {
        UserRepository userRepository = userRepositoryProvider.getIfAvailable();
        if (userRepository == null) {
            throw new IllegalStateException("User repository is unavailable");
        }
        return userRepository;
    }
}
