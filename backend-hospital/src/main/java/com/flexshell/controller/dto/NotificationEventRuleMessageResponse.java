package com.flexshell.controller.dto;

public record NotificationEventRuleMessageResponse(
        String locale,
        String titleTemplate,
        String messageTemplate
) {
}
