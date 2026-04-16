package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.RoleRequestSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminRoleServiceTest {
    private UserRepository userRepository;
    private AdminRoleService adminRoleService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<UserRepository> userProvider = mock(ObjectProvider.class);
        when(userProvider.getIfAvailable()).thenReturn(userRepository);
        adminRoleService = new AdminRoleService(userProvider);
    }

    @Test
    void nonAdminCannotApproveRoleRequest() {
        UserEntity patient = new UserEntity();
        patient.setId("u-1");
        patient.setRole(UserRole.PATIENT);
        when(userRepository.findById("u-1")).thenReturn(Optional.of(patient));

        assertThrows(SecurityException.class, () -> adminRoleService.approveRoleRequest("target", "u-1"));
    }

    @Test
    void adminCanApprovePendingRoleRequest() {
        UserEntity admin = new UserEntity();
        admin.setId("admin-1");
        admin.setRole(UserRole.ADMIN);
        when(userRepository.findById("admin-1")).thenReturn(Optional.of(admin));

        UserEntity target = new UserEntity();
        target.setId("target-1");
        target.setEmail("doc@example.com");
        target.setRole(UserRole.PATIENT);
        target.setRoleStatus(RoleRequestStatus.PENDING_APPROVAL);
        target.setRequestedRole(UserRole.DOCTOR);
        when(userRepository.findById("target-1")).thenReturn(Optional.of(target));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RoleRequestSummary summary = adminRoleService.approveRoleRequest("target-1", "admin-1");

        assertEquals("DOCTOR", summary.role());
        assertEquals("ACTIVE", summary.roleStatus());
    }
}
