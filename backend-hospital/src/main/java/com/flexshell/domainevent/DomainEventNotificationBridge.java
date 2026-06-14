package com.flexshell.domainevent;

import com.flexshell.notification.NotificationService;
import com.flexshell.notification.NotificationTriggerSupport;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class DomainEventNotificationBridge {

    private final NotificationService notificationService;

    public DomainEventNotificationBridge(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @EventListener
    public void onDomainEvent(DomainEventApplicationEvent event) {
        if (event == null || event.getDomainEvent() == null) {
            return;
        }
        DomainEvent domainEvent = event.getDomainEvent();
        NotificationTriggerSupport.triggerSafely(
                notificationService,
                domainEvent.eventType(),
                domainEvent.actorUserId(),
                domainEvent.context()
        );
    }
}
