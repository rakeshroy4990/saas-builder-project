package com.flexshell.domainevent;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class DomainEventPublisher {

    private final ApplicationEventPublisher applicationEventPublisher;

    public DomainEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    public void publish(String eventType, String actorUserId, Map<String, Object> context) {
        if (eventType == null || eventType.isBlank()) {
            return;
        }
        applicationEventPublisher.publishEvent(
                new DomainEventApplicationEvent(this, new DomainEvent(eventType.trim(), actorUserId, context))
        );
    }
}
