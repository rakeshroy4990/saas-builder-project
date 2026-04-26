package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HospitalVideoSessionResponse(
        @JsonProperty("Provider")
        String provider,
        @JsonProperty("RoomId")
        String roomId,
        @JsonProperty("Token")
        String token,
        @JsonProperty("ExpiresAt")
        String expiresAt,
        @JsonProperty("AppId")
        String appId,
        @JsonProperty("Uid")
        Long uid
) {
    public static HospitalVideoSessionResponse builtin() {
        return new HospitalVideoSessionResponse("builtin", null, null, null, null, null);
    }
}
