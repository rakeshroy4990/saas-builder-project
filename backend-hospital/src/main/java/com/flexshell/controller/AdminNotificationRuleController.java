package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.CreateNotificationRuleRequest;
import com.flexshell.controller.dto.NotificationEventRuleResponse;
import com.flexshell.controller.dto.NotificationRuleSaveRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.UpdateNotificationRuleRequest;
import com.flexshell.notification.NotificationRuleAdminService;
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
@RequestMapping("/api/v1/admin/notification-rules")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class AdminNotificationRuleController {
    private final LocalizedApiMessages messages;


    private final NotificationRuleAdminService notificationRuleAdminService;

    public AdminNotificationRuleController(NotificationRuleAdminService notificationRuleAdminService,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.notificationRuleAdminService = notificationRuleAdminService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<NotificationEventRuleResponse>>> listRules() {
        List<NotificationEventRuleResponse> data = notificationRuleAdminService.listRules();
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.rules.loaded"), data));
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<NotificationEventRuleResponse>> saveRule(
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

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<NotificationEventRuleResponse>> createRule(
            @RequestBody CreateNotificationRuleRequest request
    ) {
        try {
            NotificationEventRuleResponse data = notificationRuleAdminService.createRule(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(StandardApiResponse.success(messages.success("success.notification.rule.created"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_RULE_INVALID"), "NOTIFICATION_RULE_INVALID"));
        }
    }

    @PutMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<NotificationEventRuleResponse>> updateRule(
            @PathVariable UUID externalId,
            @RequestBody UpdateNotificationRuleRequest request
    ) {
        try {
            NotificationEventRuleResponse data = notificationRuleAdminService.updateRule(externalId, request);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.rule.updated"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_RULE_INVALID"), "NOTIFICATION_RULE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> deleteRule(@PathVariable UUID externalId) {
        try {
            notificationRuleAdminService.deleteRule(externalId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.rule.deleted"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_RULE_NOT_FOUND"), "NOTIFICATION_RULE_NOT_FOUND"));
        }
    }
}
