package com.flexshell.video;

import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Placeholder so {@link VideoSessionPort} is wired when {@code app.video.provider} is set to a value we do not ship yet.
 */
@Component
@ConditionalOnProperty(name = "app.video.provider", havingValue = "100ms")
public class UnsupportedVideoSessionAdapter implements VideoSessionPort {
    @Override
    public HospitalVideoSessionResponse createSession(String initiatorUserId, String peerUserId, String appointmentIdOrNull) {
        throw new IllegalStateException("app.video.provider=100ms is not implemented yet; use builtin or agora.");
    }
}
