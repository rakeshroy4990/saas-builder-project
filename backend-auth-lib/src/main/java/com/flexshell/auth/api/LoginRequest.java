package com.flexshell.auth.api;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    @JsonAlias({"EmailId"})
    @NotBlank(message = "EmailId is required")
    private String emailId;

    @JsonAlias({"Password"})
    @NotBlank(message = "Password is required")
    private String password;

    public String getEmailId() {
        return emailId;
    }

    public void setEmailId(String emailId) {
        this.emailId = emailId;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}

