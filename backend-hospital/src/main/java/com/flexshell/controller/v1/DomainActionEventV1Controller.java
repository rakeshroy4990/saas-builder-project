package com.flexshell.controller.v1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.DomainActionEventQueryDto;
import com.flexshell.controller.dto.DomainActionEventResponse;
import com.flexshell.controller.dto.DomainActionEventSaveRequest;
import com.flexshell.controller.dto.PagedDomainActionEventListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.domainevent.DomainActionEventAdminService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/domain-action-events")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class DomainActionEventV1Controller {

    private static final Set<String> QUERY_KEYS = Set.of("HttpMethod", "EndpointPattern", "EventType", "Enabled");

    private final DomainActionEventAdminService domainActionEventAdminService;
    private final ObjectMapper objectMapper;

    public DomainActionEventV1Controller(
            DomainActionEventAdminService domainActionEventAdminService,
            ObjectMapper objectMapper
    ) {
        this.domainActionEventAdminService = domainActionEventAdminService;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DomainActionEventResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "Query", required = false) String queryJson,
            @ModelAttribute DomainActionEventQueryDto query
    ) {
        try {
            EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedDomainActionEventListDto paged = domainActionEventAdminService.listBindingsPaged(page, size, query);
            return EntityListResponseSupport.ok(
                    "Domain action bindings loaded",
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOMAIN_ACTION_EVENT_LIST_INVALID"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DomainActionEventResponse>> save(
            @RequestBody DomainActionEventSaveRequest request
    ) {
        try {
            DomainActionEventResponse data = domainActionEventAdminService.saveBinding(request);
            return ResponseEntity.ok(StandardApiResponse.success("Domain action binding saved", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOMAIN_ACTION_EVENT_SAVE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(@PathVariable UUID businessKey) {
        try {
            domainActionEventAdminService.deleteBinding(businessKey);
            return ResponseEntity.ok(StandardApiResponse.success("Domain action binding deleted", null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOMAIN_ACTION_EVENT_NOT_FOUND"));
        }
    }
}
