package com.flexshell.controller;

import com.flexshell.auth.api.AuthFacade;
import com.flexshell.auth.api.RefreshTokenRequest;
import com.flexshell.auth.api.RefreshTokenResponse;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Mirrors the production failure mode: POST with only {@code DeviceId} and no cookie yields empty refresh
 * and {@code AUTH_REFRESH_INVALID}.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthRefreshEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthFacade authFacade;

    @BeforeEach
    void resetAuthFacadeMock() {
        reset(authFacade);
    }

    @Test
    void refresh_deviceOnlyNoCookie_returns401() throws Exception {
        when(authFacade.refresh(any())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("AUTH_REFRESH_INVALID"));
    }

    @Test
    void refresh_withRefreshTokenInBody_returns200() throws Exception {
        when(authFacade.refresh(argThat(req -> req != null && "rt-body".equals(req.getRefreshToken()))))
                .thenReturn(Optional.of(new RefreshTokenResponse("at", 900L, "rt-new", 3600L)));

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\",\"RefreshToken\":\"rt-body\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").value("at"));
    }

    @Test
    void refresh_fallsBackToCookieWhenBodyRefreshMissing() throws Exception {
        when(authFacade.refresh(argThat(req -> req != null && "from-cookie".equals(req.getRefreshToken()))))
                .thenReturn(Optional.of(new RefreshTokenResponse("a", 1L, "r", 1L)));

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\"}")
                        .cookie(new Cookie("refresh_token", "from-cookie")))
                .andExpect(status().isOk());

        verify(authFacade).refresh(argThat(req -> req != null && "from-cookie".equals(req.getRefreshToken())));
    }
}
