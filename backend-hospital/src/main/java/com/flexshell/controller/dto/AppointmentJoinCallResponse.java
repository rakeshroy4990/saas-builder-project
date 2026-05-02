package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response for {@code POST /api/appointment/{id}/join-call}. Field names align with {@link HospitalVideoSessionResponse}
 * plus {@code ChannelName} (same value as {@code RoomId}, i.e. the Agora channel = appointment id).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AppointmentJoinCallResponse(
        @JsonProperty("Provider") String provider,
        @JsonProperty("RoomId") String roomId,
        @JsonProperty("ChannelName") String channelName,
        @JsonProperty("Token") String token,
        @JsonProperty("ExpiresAt") String expiresAt,
        @JsonProperty("AppId") String appId,
        @JsonProperty("Uid") Long uid
) {
    public static AppointmentJoinCallResponse fromHospitalSession(
            HospitalVideoSessionResponse session,
            String channel
    ) {
        if (session == null) {
            return null;
        }
        String ch = channel != null && !channel.isBlank() ? channel : session.roomId();
        return new AppointmentJoinCallResponse(
                session.provider(),
                ch,
                ch,
                session.token(),
                session.expiresAt(),
                session.appId(),
                session.uid()
        );
    }
}
