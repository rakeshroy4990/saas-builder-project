package com.flexshell.controller.v1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.auth.api.RegisterResponse;
import com.flexshell.controller.dto.PagedUserListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.UserQueryDto;
import com.flexshell.controller.dto.UserSaveRequest;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/users")
public class UserV1Controller {

    private static final Set<String> QUERY_KEYS = Set.of("Query", "Role", "Email");

    private final UserService userService;
    private final ObjectMapper objectMapper;

    public UserV1Controller(UserService userService, ObjectMapper objectMapper) {
        this.userService = userService;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<RegisterResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "Query", required = false) String queryJson,
            @ModelAttribute UserQueryDto query,
            Authentication authentication
    ) {
        try {
            EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedUserListDto paged = userService.listUsers(
                    authentication.getName(),
                    page,
                    size,
                    query.getQuery(),
                    query.getRole()
            );
            return EntityListResponseSupport.ok(
                    "Users loaded",
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
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
}
