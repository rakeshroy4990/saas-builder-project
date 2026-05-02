package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AppointmentRenewTokenResponse(
        @JsonProperty("Token") String token,
        @JsonProperty("ExpiresAt") String expiresAt
) {
    public static AppointmentRenewTokenResponse fromSession(HospitalVideoSessionResponse session) {
        if (session == null) {
            return null;
        }
        return new AppointmentRenewTokenResponse(session.token(), session.expiresAt());
    }
}
