package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.NotificationResponse;
import com.flexshell.controller.dto.NotificationUnreadCountResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.notification.NotificationService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class NotificationController {
    private final LocalizedApiMessages messages;


    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.notificationService = notificationService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<NotificationResponse>>> list(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        Page<NotificationResponse> page = notificationService.listForUser(userId, unreadOnly, pageable);
        return EntityListResponseSupport.ok(
                messages.success("success.notification.list"),
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements());
    }

    @GetMapping(value = "/unread-count", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<NotificationUnreadCountResponse>> unreadCount(
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(StandardApiResponse.success(
                "Unread notification count fetched",
                new NotificationUnreadCountResponse(count)
        ));
    }

    @PatchMapping(value = "/{externalId}/read", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> markRead(
            @PathVariable UUID externalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            notificationService.markAsRead(externalId, userId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.marked.read"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "NOTIFICATION_NOT_FOUND"), "NOTIFICATION_NOT_FOUND"));
        }
    }

    @PatchMapping(value = "/read-all", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> markAllRead(Authentication authentication) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.notification.all.marked.read"), null));
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private <T> ResponseEntity<StandardApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
    }
}
