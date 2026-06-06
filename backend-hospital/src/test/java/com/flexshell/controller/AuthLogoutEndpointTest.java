package com.flexshell.controller;

import com.flexshell.auth.api.AuthFacade;
import com.flexshell.auth.api.LogoutRequest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthLogoutEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthFacade authFacade;

    @BeforeEach
    void resetAuthFacadeMock() {
        reset(authFacade);
    }

    @Test
    void logout_deviceOnlyNoCookie_returns200AndClearsCookies() throws Exception {
        when(authFacade.logout(any())).thenReturn(false);

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Success").value(true))
                .andExpect(header().exists("Set-Cookie"));

        verify(authFacade).logout(argThat(req -> req == null || req.getRefreshToken() == null || req.getRefreshToken().isBlank()));
    }

    @Test
    void logout_withRefreshTokenInBody_returns200() throws Exception {
        when(authFacade.logout(argThat(req -> req != null && "rt-body".equals(req.getRefreshToken()))))
                .thenReturn(true);

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\",\"RefreshToken\":\"rt-body\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Success").value(true));
    }

    @Test
    void logout_fallsBackToCookieWhenBodyRefreshMissing() throws Exception {
        when(authFacade.logout(argThat(req -> req != null && "from-cookie".equals(req.getRefreshToken()))))
                .thenReturn(true);

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\"}")
                        .cookie(new Cookie("refresh_token", "from-cookie")))
                .andExpect(status().isOk());

        verify(authFacade).logout(argThat(req -> req != null && "from-cookie".equals(req.getRefreshToken())));
    }

    @Test
    void logout_invalidRefreshTokenStillReturns200() throws Exception {
        when(authFacade.logout(any(LogoutRequest.class))).thenReturn(false);

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"DeviceId\":\"browser\",\"RefreshToken\":\"stale\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.Success").value(true));
    }
}
