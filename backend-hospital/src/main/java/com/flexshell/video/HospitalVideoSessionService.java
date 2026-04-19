package com.flexshell.video;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.appointment.AppointmentRepository;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.HospitalVideoSessionRequest;
import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import com.flexshell.realtime.webrtc.HospitalCallPermissionEvaluator;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class HospitalVideoSessionService {
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final HospitalCallPermissionEvaluator permissionEvaluator;
    private final VideoSessionPort videoSessionPort;

    public HospitalVideoSessionService(
            AppointmentRepository appointmentRepository,
            UserRepository userRepository,
            HospitalCallPermissionEvaluator permissionEvaluator,
            VideoSessionPort videoSessionPort
    ) {
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.permissionEvaluator = permissionEvaluator;
        this.videoSessionPort = videoSessionPort;
    }

    public HospitalVideoSessionResponse create(String initiatorUserId, HospitalVideoSessionRequest request) {
        String me = normalize(initiatorUserId);
        if (me.isEmpty()) {
            throw new SecurityException("Not authenticated");
        }
        String peer = resolvePeerUserId(me, request);
        if (peer.isEmpty()) {
            throw new IllegalArgumentException("Could not resolve call peer");
        }
        if (!permissionEvaluator.canInitiate(me, peer)) {
            throw new SecurityException("Video session not permitted for this peer");
        }
        String apId = normalize(request.appointmentId());
        return videoSessionPort.createSession(me, peer, apId.isEmpty() ? null : apId);
    }

    private String resolvePeerUserId(String me, HospitalVideoSessionRequest request) {
        String apId = normalize(request.appointmentId());
        String explicitPeer = normalize(request.peerUserId());
        if (!apId.isEmpty()) {
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
            UserEntity self = userRepository.findById(me).orElse(null);
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
