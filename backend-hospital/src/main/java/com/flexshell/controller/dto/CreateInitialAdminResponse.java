package com.flexshell.controller.dto;

public record CreateInitialAdminResponse(
        String userId,
        String email,
        String role,
        String roleStatus
) {
}
