package com.flexshell.controller.v1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.ChildProfileQueryDto;
import com.flexshell.controller.dto.ChildProfileResponse;
import com.flexshell.controller.dto.ChildProfileSaveRequest;
import com.flexshell.controller.dto.GrowthChartContextResponse;
import com.flexshell.controller.dto.PagedChildProfileListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.ChildProfileService;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/child-profiles")
public class ChildProfileV1Controller {

    private static final Set<String> QUERY_KEYS = Set.of("DisplayName", "PatientUserId");

    private final ChildProfileService childProfileService;
    private final LocalizedApiMessages messages;
    private final ObjectMapper objectMapper;

    public ChildProfileV1Controller(
            ChildProfileService childProfileService,
            LocalizedApiMessages messages,
            ObjectMapper objectMapper
    ) {
        this.childProfileService = childProfileService;
        this.messages = messages;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<ChildProfileResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @ModelAttribute ChildProfileQueryDto query,
            @RequestParam(value = "Query", required = false) String queryJson,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            ChildProfileQueryDto bound = EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedChildProfileListDto paged = childProfileService.listForActor(userId, page, size, bound);
            return EntityListResponseSupport.ok(
                    messages.success("success.child.profile.list"),
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

    @GetMapping(value = "/{externalId}/growth/chart-context", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<GrowthChartContextResponse>> chartContext(
            @PathVariable UUID externalId,
            @RequestParam(defaultValue = "wfa") String metric,
            @RequestParam(name = "Metric", required = false) String metricAlias,
            @RequestParam(defaultValue = "0") int fromMonths,
            @RequestParam(name = "FromMonths", required = false) Integer fromMonthsAlias,
            @RequestParam(defaultValue = "60") int toMonths,
            @RequestParam(name = "ToMonths", required = false) Integer toMonthsAlias,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            String resolvedMetric = metricAlias != null && !metricAlias.isBlank() ? metricAlias : metric;
            int resolvedFrom = fromMonthsAlias != null ? fromMonthsAlias : fromMonths;
            int resolvedTo = toMonthsAlias != null ? toMonthsAlias : toMonths;
            GrowthChartContextResponse data = childProfileService.chartContext(
                    userId,
                    externalId,
                    resolvedMetric,
                    resolvedFrom,
                    resolvedTo,
                    normalizeLocale(acceptLanguage)
            );
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.growth.chart.context"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<ChildProfileResponse>> save(
            @RequestBody ChildProfileSaveRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            ChildProfileResponse data = childProfileService.save(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.child.profile.saved"), data));
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
            childProfileService.deleteByBusinessKey(userId, externalId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.child.profile.deleted"), null));
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

    private static String normalizeLocale(String acceptLanguage) {
        String raw = Objects.toString(acceptLanguage, "en").trim().toLowerCase();
        if (raw.isBlank()) {
            return "en";
        }
        int comma = raw.indexOf(',');
        if (comma > 0) {
            raw = raw.substring(0, comma).trim();
        }
        int dash = raw.indexOf('-');
        return dash > 0 ? raw.substring(0, dash) : raw;
    }
}
