package com.flexshell.video;

import com.flexshell.controller.dto.HospitalVideoSessionResponse;

/**
 * Server-side minted credentials for third-party RTC; built-in returns {@code provider=builtin}.
 */
public interface VideoSessionPort {
    HospitalVideoSessionResponse createSession(String initiatorUserId, String peerUserId, String appointmentIdOrNull);
}
