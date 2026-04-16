package com.flexshell.controller;

import com.flexshell.auth.api.ApiResponse;
import com.flexshell.controller.dto.RoleDecisionRequest;
import com.flexshell.controller.dto.RoleRequestSummary;
import com.flexshell.service.AdminRoleService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/role-requests")
@ConditionalOnBean(AdminRoleService.class)
public class AdminRoleController {
    private final AdminRoleService adminRoleService;

    public AdminRoleController(AdminRoleService adminRoleService) {
        this.adminRoleService = adminRoleService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RoleRequestSummary>>> listPendingRoleRequests(
            Authentication authentication,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        try {
            List<RoleRequestSummary> data = adminRoleService.listPendingRoleRequests(authentication.getName(), page, size);
            return ResponseEntity.ok(ApiResponse.success("Pending role requests loaded", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(ex.getMessage(), "ROLE_REQUEST_FORBIDDEN"));
        }
    }

    @PostMapping("/{userId}/approve")
    public ResponseEntity<ApiResponse<RoleRequestSummary>> approve(
            @PathVariable String userId,
            Authentication authentication
    ) {
        try {
            RoleRequestSummary data = adminRoleService.approveRoleRequest(userId, authentication.getName());
            return ResponseEntity.ok(ApiResponse.success("Role request approved", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(ex.getMessage(), "ROLE_REQUEST_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(ex.getMessage(), "ROLE_REQUEST_INVALID"));
        }
    }

    @PostMapping("/{userId}/reject")
    public ResponseEntity<ApiResponse<RoleRequestSummary>> reject(
            @PathVariable String userId,
            @RequestBody(required = false) RoleDecisionRequest request,
            Authentication authentication
    ) {
        String reason = request == null ? null : request.getReason();
        try {
            RoleRequestSummary data = adminRoleService.rejectRoleRequest(userId, authentication.getName(), reason);
            return ResponseEntity.ok(ApiResponse.success("Role request rejected", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(ex.getMessage(), "ROLE_REQUEST_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(ex.getMessage(), "ROLE_REQUEST_INVALID"));
        }
    }
}
