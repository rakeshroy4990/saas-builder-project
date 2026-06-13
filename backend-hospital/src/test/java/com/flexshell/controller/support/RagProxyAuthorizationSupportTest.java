package com.flexshell.controller.support;

import com.flexshell.auth.security.AuthRequestAttributes;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RagProxyAuthorizationSupportTest {

    @Test
    void prefersRawAccessTokenAttribute() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(AuthRequestAttributes.RAW_ACCESS_TOKEN, "jwt-from-filter");

        String auth = RagProxyAuthorizationSupport.resolveBearerAuthorization(request, "access_token");

        assertEquals("Bearer jwt-from-filter", auth);
    }

    @Test
    void fallsBackToAuthorizationHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer header-token");

        String auth = RagProxyAuthorizationSupport.resolveBearerAuthorization(request, "access_token");

        assertEquals("Bearer header-token", auth);
    }

    @Test
    void fallsBackToAccessTokenCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", "cookie-token"));

        String auth = RagProxyAuthorizationSupport.resolveBearerAuthorization(request, "access_token");

        assertEquals("Bearer cookie-token", auth);
    }

    @Test
    void returnsNullWhenNoCredentials() {
        MockHttpServletRequest request = new MockHttpServletRequest();

        String auth = RagProxyAuthorizationSupport.resolveBearerAuthorization(request, "access_token");

        assertNull(auth);
    }
}
