package com.flexshell.video;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.persistence.api.AppointmentAccess;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.HospitalVideoSessionRequest;
import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import com.flexshell.realtime.webrtc.HospitalCallPermissionEvaluator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class HospitalVideoSessionService {
    private final ObjectProvider<AppointmentAccess> appointmentAccessProvider;
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final HospitalCallPermissionEvaluator permissionEvaluator;
    private final VideoSessionPort videoSessionPort;
    private final String videoProvider;

    public HospitalVideoSessionService(
            ObjectProvider<AppointmentAccess> appointmentAccessProvider,
            ObjectProvider<UserAccess> userAccessProvider,
            HospitalCallPermissionEvaluator permissionEvaluator,
            VideoSessionPort videoSessionPort,
            @Value("${app.video.provider:builtin}") String videoProvider
    ) {
        this.appointmentAccessProvider = appointmentAccessProvider;
        this.userAccessProvider = userAccessProvider;
        this.permissionEvaluator = permissionEvaluator;
        this.videoSessionPort = videoSessionPort;
        this.videoProvider = Objects.toString(videoProvider, "builtin").trim();
    }

    public HospitalVideoSessionResponse create(String initiatorUserId, HospitalVideoSessionRequest request) {
        String me = normalize(initiatorUserId);
        if (me.isEmpty()) {
            throw new SecurityException("Not authenticated");
        }
        String apId = normalize(request.appointmentId());
        if ("agora".equalsIgnoreCase(videoProvider) && apId.isEmpty()) {
            throw new IllegalArgumentException(
                    "Agora RTC requires an appointment-bound channel. Use POST /api/appointment/{id}/join-call "
                            + "or pass appointmentId when creating a session.");
        }
        String peer = resolvePeerUserId(me, request);
        if (peer.isEmpty()) {
            throw new IllegalArgumentException("Could not resolve call peer");
        }
        if (!permissionEvaluator.canInitiate(me, peer)) {
            throw new SecurityException("Video session not permitted for this peer");
        }
        return videoSessionPort.createSession(me, peer, apId.isEmpty() ? null : apId);
    }

    private String resolvePeerUserId(String me, HospitalVideoSessionRequest request) {
        String apId = normalize(request.appointmentId());
        String explicitPeer = normalize(request.peerUserId());
        if (!apId.isEmpty()) {
            AppointmentAccess appointmentRepository = appointmentAccessProvider.getIfAvailable();
            if (appointmentRepository == null) {
                throw new IllegalStateException("Appointment persistence is unavailable");
            }
            AppointmentEntity ap = appointmentRepository.findById(apId)
                    .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
            String doctor = normalize(ap.getDoctorId());
            String patient = normalize(ap.getCreatedBy());
            if (me.equals(patient)) {
                return doctor;
            }
            if (me.equals(doctor)) {
                return patient;
            }
            UserAccess users = userAccessProvider.getIfAvailable();
            UserEntity self = users == null ? null : users.findById(me).orElse(null);
            if (self != null && self.getRole() == UserRole.ADMIN) {
                if (!explicitPeer.isEmpty()) {
                    return explicitPeer;
                }
                if (!patient.isEmpty()) {
                    return patient;
                }
                return doctor;
            }
            throw new SecurityException("Not a participant on this appointment");
        }
        if (!explicitPeer.isEmpty()) {
            return explicitPeer;
        }
        return "";
    }

    private static String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}
