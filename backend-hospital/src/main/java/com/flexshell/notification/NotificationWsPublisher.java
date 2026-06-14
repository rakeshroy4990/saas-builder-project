package com.flexshell.notification;

import com.flexshell.controller.dto.NotificationResponse;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class NotificationWsPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public NotificationWsPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishToUser(String recipientUserId, NotificationResponse notification, long unreadCount) {
        if (recipientUserId == null || recipientUserId.isBlank() || notification == null) {
            return;
        }
        NotificationWsEvent event = new NotificationWsEvent();
        event.setExternalId(notification.externalId());
        event.setEventType(notification.eventType());
        event.setTitle(notification.title());
        event.setMessage(notification.message());
        event.setEntityType(notification.entityType());
        event.setEntityExternalId(notification.entityExternalId());
        event.setEntityRefId(notification.entityRefId());
        event.setRead(notification.isRead());
        event.setCreatedAt(notification.createdAt());
        event.setUnreadCount(unreadCount);
        messagingTemplate.convertAndSendToUser(
                recipientUserId.trim(),
                "/queue/notifications",
                event
        );
    }
}
