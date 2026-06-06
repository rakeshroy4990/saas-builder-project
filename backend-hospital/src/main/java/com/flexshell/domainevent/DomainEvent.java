package com.flexshell.domainevent;

import java.util.Map;

public record DomainEvent(String eventType, String actorUserId, Map<String, Object> context) {
}
