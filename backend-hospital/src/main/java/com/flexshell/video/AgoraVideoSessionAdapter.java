package com.flexshell.video;

import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import io.agora.media.RtcTokenBuilder2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "app.video.provider", havingValue = "agora")
public class AgoraVideoSessionAdapter implements VideoSessionPort {
    private final String appId;
    private final String appCertificate;
    private final int tokenTtlSeconds;

    public AgoraVideoSessionAdapter(
            @Value("${app.video.agora.app-id:}") String appId,
            @Value("${app.video.agora.app-certificate:}") String appCertificate,
            @Value("${app.video.agora.token-ttl-seconds:3600}") int tokenTtlSeconds
    ) {
        this.appId = Objects.toString(appId, "").trim();
        this.appCertificate = Objects.toString(appCertificate, "").trim();
        int ttl = Math.max(60, tokenTtlSeconds);
        this.tokenTtlSeconds = Math.min(ttl, 3600);
        if (this.appId.isEmpty()) {
            throw new IllegalStateException(
                    "app.video.provider=agora requires APP_VIDEO_AGORA_APP_ID (or app.video.agora.app-id). "
                            + "Without an App ID the backend cannot start in Agora mode.");
        }
        if (this.appCertificate.isEmpty()) {
            throw new IllegalStateException(
                    "app.video.provider=agora requires APP_VIDEO_AGORA_APP_CERTIFICATE. "
                            + "Map Secret Manager secret backend-hospital-app-video-agora-certificate to that env var "
                            + "(see root cloudbuild.yaml deploy-backend --set-secrets). "
                            + "RTC tokens cannot be minted without the App Certificate; Agora calls are disabled until it is set.");
        }
    }

    @Override
    public HospitalVideoSessionResponse createSession(String initiatorUserId, String peerUserId, String appointmentIdOrNull) {
        String channel = buildChannelName(appointmentIdOrNull, peerUserId, initiatorUserId);
        int uid = rtcUid(initiatorUserId);
        RtcTokenBuilder2 builder = new RtcTokenBuilder2();
        String token = builder.buildTokenWithUid(
                appId,
                appCertificate,
                channel,
                uid,
                RtcTokenBuilder2.Role.ROLE_PUBLISHER,
                tokenTtlSeconds,
                tokenTtlSeconds
        );
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Agora token builder returned an empty token");
        }
        String expiresAt = Instant.now().plusSeconds(tokenTtlSeconds).toString();
        return new HospitalVideoSessionResponse("agora", channel, token, expiresAt, appId, (long) uid);
    }

    /**
     * Production: channel must be the appointment id (opaque UUID) so tokens are not usable on guessable names.
     * Fallback (non-appointment) is only for dev / non-Agora paths — {@link com.flexshell.video.HospitalVideoSessionService}
     * rejects Agora without an appointment id.
     */
    static String buildChannelName(String appointmentId, String peerUserId, String initiatorUserId) {
        String base;
        if (appointmentId != null && !appointmentId.isBlank()) {
            base = sanitize(appointmentId.trim());
        } else {
            String a = sanitize(initiatorUserId);
            String b = sanitize(peerUserId);
            if (a.compareTo(b) > 0) {
                String tmp = a;
                a = b;
                b = tmp;
            }
            base = "hosp-peer-" + a + "-" + b;
        }
        if (base.length() > 64) {
            base = base.substring(0, 64);
        }
        return base;
    }

    private static String sanitize(String raw) {
        String s = Objects.toString(raw, "").trim();
        if (s.isEmpty()) return "x";
        return s.replaceAll("[^a-zA-Z0-9!#$%&()+-:;<=>?@\\[\\]^_{|}~,. ]", "_");
    }

    static int rtcUid(String userId) {
        int h = Objects.hashCode(Objects.toString(userId, "user"));
        int uid = h & 0x7fffffff;
        return uid == 0 ? 1 : uid;
    }
}
