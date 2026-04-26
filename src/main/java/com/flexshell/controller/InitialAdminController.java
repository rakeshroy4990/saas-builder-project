package com.flexshell.controller;

import com.flexshell.auth.api.ApiResponse;
import com.flexshell.controller.dto.CreateInitialAdminRequest;
import com.flexshell.controller.dto.CreateInitialAdminResponse;
import com.flexshell.service.InitialAdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/setup")
public class InitialAdminController {
    private final InitialAdminService initialAdminService;

    public InitialAdminController(InitialAdminService initialAdminService) {
        this.initialAdminService = initialAdminService;
    }

    @PostMapping(value = "/initial-admin", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<CreateInitialAdminResponse>> createInitialAdmin(
            @Valid @RequestBody CreateInitialAdminRequest request
    ) {
        try {
            CreateInitialAdminResponse response = initialAdminService.createInitialAdmin(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success("Initial admin created", response));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error(ex.getMessage(), "INITIAL_ADMIN_EXISTS"));
        }
    }
}
