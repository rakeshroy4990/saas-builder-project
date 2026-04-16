package com.flexshell.auth.security;

import org.springframework.security.core.Authentication;

public interface BearerTokenAuthenticator {
    Authentication authenticate(String token) throws AuthTokenException;
}
