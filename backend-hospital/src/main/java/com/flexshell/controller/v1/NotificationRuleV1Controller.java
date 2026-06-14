package com.flexshell.controller.v1;

import com.flexshell.i18n.LocalizedApiMessages;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.NotificationEventRuleResponse;
import com.flexshell.controller.dto.NotificationRuleQueryDto;
import com.flexshell.controller.dto.NotificationRuleSaveRequest;
import com.flexshell.controller.dto.PagedNotificationRuleListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.notification.NotificationRuleAdminService;
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
@RequestMapping("/api/v1/notification-rules")
public class NotificationRuleV1Controller {
    private final LocalizedApiMessages messages;


    private static final Set<String> QUERY_KEYS = Set.of("EventType", "RecipientRole", "Enabled");

    private final NotificationRuleAdminService notificationRuleAdminService;
    private final ObjectMapper objectMapper;

    public NotificationRuleV1Controller(NotificationRuleAdminService notificationRuleAdminService,
            ObjectMapper objectMapper,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.notificationRuleAdminService = notificationRuleAdminService;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<NotificationEventRuleResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "Query", required = false) String queryJson,
            @ModelAttribute NotificationRuleQueryDto query
    ) {
        try {
            EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedNotificationRuleListDto paged = notificationRuleAdminService.listRulesPaged(page, size, query);
            return EntityListResponseSupport.ok(
                    messages.success("success.notification.rules.loaded"),
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_RULE_LIST_INVALID"), "NOTIFICATION_RULE_LIST_INVALID"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<NotificationEventRuleResponse>> save(
            @RequestBody NotificationRuleSaveRequest request
    ) {
        try {
            NotificationEventRuleResponse data = notificationRuleAdminService.saveRule(request);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.rule.saved"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_RULE_SAVE_INVALID"), "NOTIFICATION_RULE_SAVE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(@PathVariable UUID businessKey) {
        try {
            notificationRuleAdminService.deleteRule(businessKey);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.rule.deleted"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_RULE_NOT_FOUND"), "NOTIFICATION_RULE_NOT_FOUND"));
        }
    }
}
