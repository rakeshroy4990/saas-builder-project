package com.flexshell.auth.api;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public class GoogleLoginRequest {
    @JsonAlias({"AccessToken"})
    @NotBlank(message = "AccessToken is required")
    private String accessToken;

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }
}
