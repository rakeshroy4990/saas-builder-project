package com.flexshell.controller;

import com.flexshell.controller.dto.CreateDomainActionEventRequest;
import com.flexshell.controller.dto.DomainActionEventResponse;
import com.flexshell.controller.dto.DomainActionEventSaveRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.UpdateDomainActionEventRequest;
import com.flexshell.domainevent.DomainActionEventAdminService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/domain-action-events")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class AdminDomainActionEventController {

    private final DomainActionEventAdminService domainActionEventAdminService;

    public AdminDomainActionEventController(DomainActionEventAdminService domainActionEventAdminService) {
        this.domainActionEventAdminService = domainActionEventAdminService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DomainActionEventResponse>>> listBindings() {
        return ResponseEntity.ok(StandardApiResponse.success(
                "Domain action bindings loaded",
                domainActionEventAdminService.listBindings()
        ));
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DomainActionEventResponse>> saveBinding(
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

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DomainActionEventResponse>> createBinding(
            @RequestBody CreateDomainActionEventRequest request
    ) {
        try {
            DomainActionEventResponse data = domainActionEventAdminService.createBinding(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(StandardApiResponse.success("Domain action binding created", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOMAIN_ACTION_EVENT_INVALID"));
        }
    }

    @PutMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DomainActionEventResponse>> updateBinding(
            @PathVariable UUID externalId,
            @RequestBody UpdateDomainActionEventRequest request
    ) {
        try {
            DomainActionEventResponse data = domainActionEventAdminService.updateBinding(externalId, request);
            return ResponseEntity.ok(StandardApiResponse.success("Domain action binding updated", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOMAIN_ACTION_EVENT_INVALID"));
        }
    }

    @DeleteMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> deleteBinding(@PathVariable UUID externalId) {
        try {
            domainActionEventAdminService.deleteBinding(externalId);
            return ResponseEntity.ok(StandardApiResponse.success("Domain action binding deleted", null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOMAIN_ACTION_EVENT_NOT_FOUND"));
        }
    }
}
