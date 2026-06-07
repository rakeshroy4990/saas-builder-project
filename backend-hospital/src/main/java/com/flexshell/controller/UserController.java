package com.flexshell.controller;

import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import com.flexshell.controller.dto.PagedUserListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.UserSaveRequest;
import com.flexshell.controller.dto.YoutubeQueryCacheEntryDto;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.service.UserService;
import com.flexshell.service.YoutubeQueryCacheService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user")
public class UserController {
    private final UserService userService;
    private final YoutubeQueryCacheService youtubeQueryCacheService;

    public UserController(UserService userService, YoutubeQueryCacheService youtubeQueryCacheService) {
        this.userService = userService;
        this.youtubeQueryCacheService = youtubeQueryCacheService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<?>> getUser(
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "role", required = false) String role,
            Authentication authentication
    ) {
        if (userId != null && !userId.isBlank()) {
            if (!isSelf(authentication, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(StandardApiResponse.error("Forbidden", "USER_FORBIDDEN"));
            }
            return userService
                    .getByUserId(trim(userId))
                    .<ResponseEntity<StandardApiResponse<?>>>map(body -> ResponseEntity.ok(StandardApiResponse.success("OK", body)))
                    .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(StandardApiResponse.error("User not found", "USER_NOT_FOUND")));
        }
        try {
            PagedUserListDto paged = userService.listUsers(authentication.getName(), page, size, query, role);
            @SuppressWarnings("unchecked")
            ResponseEntity<StandardApiResponse<?>> listResponse = (ResponseEntity) EntityListResponseSupport.ok(
                    "Users loaded",
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
            return listResponse;
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_LIST_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_LIST_INVALID"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<RegisterResponse>> save(
            @RequestBody UserSaveRequest request,
            Authentication authentication
    ) {
        try {
            RegisterResponse data = userService.saveUser(authentication.getName(), request);
            return ResponseEntity.ok(StandardApiResponse.success("User saved", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_SAVE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_SAVE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable String businessKey,
            Authentication authentication
    ) {
        try {
            userService.deleteByBusinessKey(businessKey, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("User deactivated", null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_DELETE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "USER_DELETE_INVALID"));
        }
    }

    /**
     * Recent YouTube hero search rows from {@code query_cache} for the authenticated user (self only).
     */
    @GetMapping(value = "/youtube-queries", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<YoutubeQueryCacheEntryDto>>> listYoutubeQueries(
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "limit", required = false, defaultValue = "50") int limit,
            Authentication authentication
    ) {
        String id = resolveActorUserId(userId, authentication);
        if (id.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(
                            "userId is required or you must be authenticated",
                            "USER_QUERY_INVALID"));
        }
        if (!isSelf(authentication, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Forbidden", "USER_FORBIDDEN"));
        }
        List<YoutubeQueryCacheEntryDto> rows = youtubeQueryCacheService.listRecentForUser(id, limit);
        return ResponseEntity.ok(StandardApiResponse.success("OK", rows));
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
