package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record NotificationUnreadCountResponse(
        @JsonProperty("Count") long count
) {
}
