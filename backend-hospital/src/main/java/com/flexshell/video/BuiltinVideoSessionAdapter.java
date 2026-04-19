package com.flexshell.video;

import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.video.provider", havingValue = "builtin", matchIfMissing = true)
public class BuiltinVideoSessionAdapter implements VideoSessionPort {
    @Override
    public HospitalVideoSessionResponse createSession(String initiatorUserId, String peerUserId, String appointmentIdOrNull) {
        return HospitalVideoSessionResponse.builtin();
    }
}
