package com.flexshell.video;

import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.video.provider", havingValue = "twilio")
public class UnsupportedTwilioVideoSessionAdapter implements VideoSessionPort {
    @Override
    public HospitalVideoSessionResponse createSession(String initiatorUserId, String peerUserId, String appointmentIdOrNull) {
        throw new IllegalStateException("app.video.provider=twilio is not implemented yet; use builtin or agora.");
    }
}
