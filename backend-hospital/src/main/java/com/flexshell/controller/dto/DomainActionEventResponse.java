package com.flexshell.controller.dto;

import java.util.UUID;

public record DomainActionEventResponse(
        UUID externalId,
        String httpMethod,
        String endpointPattern,
        String eventType,
        String contextProfile,
        String actorRoleFilter,
        String responseRoleField,
        String responseRoleValue,
        boolean enabled
) {
}
