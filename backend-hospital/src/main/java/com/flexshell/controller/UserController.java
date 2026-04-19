package com.flexshell.controller;

import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<RegisterResponse>> getUser(
            @RequestParam("userId") String userId,
            Authentication authentication
    ) {
        if (!isSelf(authentication, userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Forbidden", "USER_FORBIDDEN"));
        }
        return userService
                .getByUserId(trim(userId))
                .map(body -> ResponseEntity.ok(StandardApiResponse.success("OK", body)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(StandardApiResponse.error("User not found", "USER_NOT_FOUND")));
    }

    @PutMapping(value = "/profile", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<RegisterResponse>> putProfile(
            @RequestParam(value = "userId", required = false) String userId,
            @RequestBody(required = false) RegisterRequest body,
            Authentication authentication
    ) {
        String id = resolveActorUserId(userId, authentication);
        if (id.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error("userId is required or you must be authenticated", "USER_PROFILE_INVALID"));
        }
        if (!isSelf(authentication, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Forbidden", "USER_FORBIDDEN"));
        }
        return tryUpdateProfile(id, body);
    }

    @PutMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<RegisterResponse>> putUser(
            @RequestParam("userId") String userId,
            @RequestParam(value = "inactive", required = false, defaultValue = "false") boolean inactive,
            @RequestBody(required = false) RegisterRequest body,
            Authentication authentication
    ) {
        if (!isSelf(authentication, userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Forbidden", "USER_FORBIDDEN"));
        }
        String id = trim(userId);
        if (inactive) {
            try {
                userService.deactivateAccount(id);
                return userService
                        .getByUserId(id)
                        .map(data -> ResponseEntity.ok(StandardApiResponse.success("Account deactivated", data)))
                        .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(StandardApiResponse.error("User not found", "USER_NOT_FOUND")));
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(StandardApiResponse.error(ex.getMessage(), "USER_DEACTIVATE_FAILED"));
            }
        }
        return tryUpdateProfile(id, body);
    }

    private ResponseEntity<StandardApiResponse<RegisterResponse>> tryUpdateProfile(String id, RegisterRequest body) {
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error("Request body is required", "USER_PROFILE_INVALID"));
        }
        try {
            RegisterResponse data = userService.updateProfile(id, body);
            return ResponseEntity.ok(StandardApiResponse.success("Profile updated", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_PROFILE_INVALID"));
        }
    }

    /** Prefer explicit {@code userId} query param; otherwise the authenticated principal (legacy callers). */
    private static String resolveActorUserId(String userIdParam, Authentication authentication) {
        String fromParam = trim(userIdParam);
        if (!fromParam.isEmpty()) {
            return fromParam;
        }
        if (authentication == null || authentication.getName() == null) {
            return "";
        }
        return trim(authentication.getName());
    }

    private static boolean isSelf(Authentication authentication, String userId) {
        if (authentication == null || userId == null) {
            return false;
        }
        String principal = authentication.getName();
        if (principal == null || principal.isBlank()) {
            return false;
        }
        return principal.trim().equals(trim(userId));
    }

    private static String trim(String userId) {
        return userId == null ? "" : userId.trim();
    }
}
