package com.flexshell.domainevent;

public class DomainEventApplicationEvent extends org.springframework.context.ApplicationEvent {

    private final DomainEvent domainEvent;

    public DomainEventApplicationEvent(Object source, DomainEvent domainEvent) {
        super(source);
        this.domainEvent = domainEvent;
    }

    public DomainEvent getDomainEvent() {
        return domainEvent;
    }
}
