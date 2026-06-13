package com.flexshell.controller.v1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.GrowthRecordQueryDto;
import com.flexshell.controller.dto.GrowthRecordResponse;
import com.flexshell.controller.dto.GrowthRecordSaveRequest;
import com.flexshell.controller.dto.PagedGrowthRecordListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.GrowthRecordService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/growth-records")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class GrowthRecordV1Controller {

    private static final Set<String> QUERY_KEYS = Set.of("ChildProfileExternalId");

    private final GrowthRecordService growthRecordService;
    private final LocalizedApiMessages messages;
    private final ObjectMapper objectMapper;

    public GrowthRecordV1Controller(
            GrowthRecordService growthRecordService,
            LocalizedApiMessages messages,
            ObjectMapper objectMapper
    ) {
        this.growthRecordService = growthRecordService;
        this.messages = messages;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<GrowthRecordResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @ModelAttribute GrowthRecordQueryDto query,
            @RequestParam(value = "Query", required = false) String queryJson,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            GrowthRecordQueryDto bound = EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedGrowthRecordListDto paged = growthRecordService.listForActor(userId, page, size, bound);
            return EntityListResponseSupport.ok(
                    messages.success("success.growth.record.list"),
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements()
            );
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<GrowthRecordResponse>> save(
            @RequestBody GrowthRecordSaveRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            GrowthRecordResponse data = growthRecordService.save(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.growth.record.saved"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    @DeleteMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable UUID externalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            growthRecordService.deleteByBusinessKey(userId, externalId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.growth.record.deleted"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    private static String actorId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return "";
        }
        return Objects.toString(authentication.getName(), "").trim();
    }
}
