package com.flexshell.auth.api;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChangePasswordRequest {
    @JsonAlias({"EmailId"})
    @NotBlank(message = "EmailId is required")
    private String emailId;

    @JsonAlias({"OldPassword"})
    @NotBlank(message = "OldPassword is required")
    private String oldPassword;

    @JsonAlias({"NewPassword"})
    @NotBlank(message = "NewPassword is required")
    @Size(min = 8, message = "NewPassword must be at least 8 characters")
    private String newPassword;

    public String getEmailId() {
        return emailId;
    }

    public void setEmailId(String emailId) {
        this.emailId = emailId;
    }

    public String getOldPassword() {
        return oldPassword;
    }

    public void setOldPassword(String oldPassword) {
        this.oldPassword = oldPassword;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }
}
