package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.flexshell.auth.api.RegisterRequest;

/**
 * Upsert body for {@code POST /api/v1/users/save} and {@code POST /api/user/save}. Business key: {@code UserId}.
 */
public class UserSaveRequest extends RegisterRequest {
    @JsonProperty("UserId")
    private String userId;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
