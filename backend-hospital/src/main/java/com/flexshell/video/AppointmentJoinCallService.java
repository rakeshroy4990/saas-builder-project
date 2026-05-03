package com.flexshell.video;

import com.flexshell.appointment.AppointmentCallStates;
import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.persistence.api.AppointmentAccess;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.AppointmentJoinCallResponse;
import com.flexshell.controller.dto.AppointmentRenewTokenResponse;
import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import com.flexshell.observability.ObservabilityLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Secure video join: participant validation, callable appointment status, slot window (± grace),
 * server-generated RTC token with channel = appointment id (see {@link AgoraVideoSessionAdapter}).
 * Persists {@link AppointmentCallStates} and supports token renewal + explicit call end.
 */
@Service
public class AppointmentJoinCallService {
    private static final Logger log = LoggerFactory.getLogger(AppointmentJoinCallService.class);

    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String STATUS_COMPLETED = "COMPLETED";

    private final ObjectProvider<AppointmentAccess> appointmentAccessProvider;
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final VideoSessionPort videoSessionPort;
    private final java.time.ZoneId hospitalZoneId;
    private final int graceMinutes;
    private final Set<String> allowedStatusesLower;
    private final int maxCallDurationHours;

    public AppointmentJoinCallService(
            ObjectProvider<AppointmentAccess> appointmentAccessProvider,
            ObjectProvider<UserAccess> userAccessProvider,
            VideoSessionPort videoSessionPort,
            @Qualifier("hospitalZoneId") java.time.ZoneId hospitalZoneId,
            @Value("${app.video.join-call-grace-minutes:10}") int graceMinutes,
            @Value("${app.video.join-call-allowed-statuses:CONFIRMED,Open}") String allowedStatusesCsv,
            @Value("${app.video.call-max-duration-hours:4}") int maxCallDurationHours
    ) {
        this.appointmentAccessProvider = appointmentAccessProvider;
        this.userAccessProvider = userAccessProvider;
        this.videoSessionPort = videoSessionPort;
        this.hospitalZoneId = hospitalZoneId;
        this.graceMinutes = Math.max(0, graceMinutes);
        this.allowedStatusesLower = parseAllowedStatuses(allowedStatusesCsv);
        this.maxCallDurationHours = Math.max(1, maxCallDurationHours);
    }

    private AppointmentAccess requireAppointmentAccess() {
        AppointmentAccess access = appointmentAccessProvider.getIfAvailable();
        if (access == null) {
            throw new IllegalStateException("Appointment persistence is unavailable");
        }
        return access;
    }

    private static Set<String> parseAllowedStatuses(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of("confirmed", "open");
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public AppointmentJoinCallResponse joinCall(String actorUserId, String appointmentId) {
        String me = Objects.toString(actorUserId, "").trim();
        if (me.isEmpty()) {
            throw new SecurityException("Not authenticated");
        }
        String apId = Objects.toString(appointmentId, "").trim();
        if (apId.isEmpty()) {
            throw new IllegalArgumentException("Appointment id is required");
        }

        AppointmentAccess appointmentRepository = requireAppointmentAccess();
        AppointmentEntity ap = appointmentRepository.findById(apId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));

        if (AppointmentCallStates.isTerminal(ap.getCallStatus())) {
            throw new IllegalArgumentException("Video call has already ended for this appointment");
        }

        assertCallableStatus(ap);
        assertWithinSlotWindow(ap);

        String peer = requirePeerForCall(ap, me);

        HospitalVideoSessionResponse session = videoSessionPort.createSession(me, peer, apId);
        String channel = session.roomId() != null ? session.roomId() : apId;

        applyJoinCallTransition(appointmentRepository, ap, me);

        ObservabilityLogger.info(log, "appointment_join_call", java.util.Map.of(
                "domain", "appointment",
                "action", "join_call_initiated",
                "appointment_id", apId,
                "user_id", me,
                "provider", Objects.toString(session.provider(), "")));

        return AppointmentJoinCallResponse.fromHospitalSession(session, channel);
    }

    /**
     * Renews an RTC token mid-call. Skips the booking slot check when a call is already active
     * ({@link AppointmentCallStates}), but enforces {@link #maxCallDurationHours} from {@link AppointmentEntity#getCallStartTime()}.
     */
    public AppointmentRenewTokenResponse renewToken(String actorUserId, String appointmentId) {
        String me = Objects.toString(actorUserId, "").trim();
        if (me.isEmpty()) {
            throw new SecurityException("Not authenticated");
        }
        String apId = Objects.toString(appointmentId, "").trim();
        if (apId.isEmpty()) {
            throw new IllegalArgumentException("Appointment id is required");
        }

        AppointmentAccess appointmentRepository = requireAppointmentAccess();
        AppointmentEntity ap = appointmentRepository.findById(apId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));

        if (AppointmentCallStates.isTerminal(ap.getCallStatus())) {
            throw new IllegalArgumentException("Cannot renew token after the call has ended");
        }

        assertCallableStatus(ap);

        if (canRenewWithoutSlotCheck(ap)) {
            assertMaxCallDuration(ap);
        } else {
            assertWithinSlotWindow(ap);
        }

        String peer = requirePeerForCall(ap, me);
        HospitalVideoSessionResponse session = videoSessionPort.createSession(me, peer, apId);

        ObservabilityLogger.info(log, "appointment_renew_token", java.util.Map.of(
                "domain", "appointment",
                "action", "rtc_token_renewed",
                "appointment_id", apId,
                "user_id", me));

        return AppointmentRenewTokenResponse.fromSession(session);
    }

    /**
     * Marks the video call ended (billing / audit). Does not change the booking {@link AppointmentEntity#getStatus()}.
     */
    public void endCall(String actorUserId, String appointmentId) {
        String me = Objects.toString(actorUserId, "").trim();
        if (me.isEmpty()) {
            throw new SecurityException("Not authenticated");
        }
        String apId = Objects.toString(appointmentId, "").trim();
        if (apId.isEmpty()) {
            throw new IllegalArgumentException("Appointment id is required");
        }

        AppointmentAccess appointmentRepository = requireAppointmentAccess();
        AppointmentEntity ap = appointmentRepository.findById(apId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));

        requirePeerForCall(ap, me);

        String cs = normalize(ap.getCallStatus());
        if (cs.isEmpty() || AppointmentCallStates.isTerminal(cs)) {
            throw new IllegalArgumentException("No active video call to end");
        }

        Instant now = Instant.now();
        ap.setCallStatus(AppointmentCallStates.CALL_ENDED);
        ap.setCallEndTime(now);
        ap.setUpdatedTimestamp(now);
        ap.setUpdatedBy(me);
        appointmentRepository.save(ap);

        ObservabilityLogger.info(log, "appointment_end_call", java.util.Map.of(
                "domain", "appointment",
                "action", "call_ended",
                "appointment_id", apId,
                "user_id", me));
    }

    private void applyJoinCallTransition(AppointmentAccess appointments, AppointmentEntity ap, String actorId) {
        if (AppointmentCallStates.isTerminal(ap.getCallStatus())) {
            return;
        }
        Instant now = Instant.now();
        String cs = normalize(ap.getCallStatus());
        if (cs.isEmpty()) {
            ap.setCallStatus(AppointmentCallStates.CALL_INITIATED);
            if (ap.getCallStartTime() == null) {
                ap.setCallStartTime(now);
            }
        } else if (AppointmentCallStates.CALL_INITIATED.equalsIgnoreCase(cs)) {
            ap.setCallStatus(AppointmentCallStates.CALL_IN_PROGRESS);
        }
        ap.setUpdatedTimestamp(now);
        ap.setUpdatedBy(actorId);
        appointments.save(ap);
    }

    private boolean canRenewWithoutSlotCheck(AppointmentEntity ap) {
        return ap.getCallStartTime() != null
                && AppointmentCallStates.allowsRenewalWithoutSlot(ap.getCallStatus());
    }

    private void assertMaxCallDuration(AppointmentEntity ap) {
        Instant start = ap.getCallStartTime();
        if (start == null) {
            return;
        }
        Instant maxEnd = start.plus(Duration.ofHours(maxCallDurationHours));
        if (Instant.now().isAfter(maxEnd)) {
            throw new IllegalArgumentException(
                    "Maximum call duration (" + maxCallDurationHours + " hours) exceeded; end the call and book again if needed.");
        }
    }

    /**
     * @return the other party’s user id for token minting (doctor ↔ patient); for admin, the doctor if present else patient.
     */
    private String requirePeerForCall(AppointmentEntity ap, String actorId) {
        String doctor = normalize(ap.getDoctorId());
        String patient = normalize(ap.getCreatedBy());
        if (actorId.equals(patient)) {
            if (doctor.isEmpty()) {
                throw new IllegalStateException("Appointment has no assigned doctor");
            }
            return doctor;
        }
        if (actorId.equals(doctor)) {
            if (patient.isEmpty()) {
                throw new IllegalStateException("Appointment has no booking user");
            }
            return patient;
        }
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new SecurityException("User persistence unavailable");
        }
        UserEntity u = users.findById(actorId).orElseThrow(() -> new SecurityException("User not found"));
        if (u.getRole() == UserRole.ADMIN) {
            if (!doctor.isEmpty()) {
                return doctor;
            }
            if (!patient.isEmpty()) {
                return patient;
            }
            throw new IllegalStateException("Appointment has no doctor or patient user id");
        }
        throw new SecurityException("Only the booking patient, assigned doctor, or an administrator may join this call");
    }

    private void assertCallableStatus(AppointmentEntity ap) {
        String raw = normalize(ap.getStatus());
        if (STATUS_CANCELLED.equalsIgnoreCase(raw)) {
            throw new IllegalArgumentException("Cannot join a cancelled appointment");
        }
        if (STATUS_COMPLETED.equalsIgnoreCase(raw)) {
            throw new IllegalArgumentException("Cannot join a completed appointment");
        }
        if (raw.isEmpty()) {
            throw new IllegalArgumentException("Appointment has no status");
        }
        if (!allowedStatusesLower.contains(raw.toLowerCase())) {
            throw new IllegalArgumentException(
                    "Appointment is not in a callable state for video (allowed: " + String.join(", ", allowedStatusesLower) + ")");
        }
    }

    private void assertWithinSlotWindow(AppointmentEntity ap) {
        AppointmentCallSlotParser.SlotWindow w = AppointmentCallSlotParser.parseWindow(ap, hospitalZoneId);
        if (w == null) {
            throw new IllegalArgumentException("Appointment has no valid preferred date and time slot for call window checks");
        }
        ZonedDateTime now = ZonedDateTime.now(hospitalZoneId);
        Duration grace = Duration.ofMinutes(graceMinutes);
        ZonedDateTime earliest = w.start().minus(grace);
        ZonedDateTime latest = w.end().plus(grace);
        if (now.isBefore(earliest) || now.isAfter(latest)) {
            throw new IllegalArgumentException(
                    "Video call is only allowed within the appointment window (± " + graceMinutes + " minutes)");
        }
    }

    private static String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}
