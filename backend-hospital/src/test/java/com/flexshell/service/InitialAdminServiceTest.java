package com.flexshell.service;

import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.CreateInitialAdminRequest;
import com.flexshell.controller.dto.CreateInitialAdminResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InitialAdminServiceTest {
    private UserAccess users;
    private InitialAdminService service;

    @BeforeEach
    void setUp() {
        users = mock(UserAccess.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<UserAccess> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(users);
        service = new InitialAdminService(provider);
    }

    @Test
    void createsInitialAdminWhenNoAdminExists() {
        when(users.countByRole(UserRole.ADMIN)).thenReturn(0L);
        when(users.findByEmail("super@hospital.local")).thenReturn(Optional.empty());
        when(users.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity user = invocation.getArgument(0);
            user.setId("admin-1");
            return user;
        });
        CreateInitialAdminRequest request = request();

        CreateInitialAdminResponse response = service.createInitialAdmin(request);

        assertEquals("admin-1", response.userId());
        assertEquals("ADMIN", response.role());
        assertEquals("ACTIVE", response.roleStatus());
    }

    @Test
    void throwsWhenAdminAlreadyExists() {
        when(users.countByRole(UserRole.ADMIN)).thenReturn(1L);

        assertThrows(IllegalStateException.class, () -> service.createInitialAdmin(request()));
    }

    private CreateInitialAdminRequest request() {
        CreateInitialAdminRequest request = new CreateInitialAdminRequest();
        request.setEmail("super@hospital.local");
        request.setPassword("StrongPass123!");
        request.setFirstName("Super");
        request.setLastName("Admin");
        return request;
    }
}
