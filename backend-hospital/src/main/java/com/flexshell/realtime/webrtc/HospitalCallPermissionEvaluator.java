package com.flexshell.realtime.webrtc;

import com.flexshell.appointment.AppointmentRepository;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class HospitalCallPermissionEvaluator implements CallPermissionEvaluator {
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;

    public HospitalCallPermissionEvaluator(AppointmentRepository appointmentRepository, UserRepository userRepository) {
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
    }

    /**
     * Hospital default policy (derived): allow calls only when a PATIENT has an appointment with the DOCTOR.
     * - Patient -> Doctor: allowed if patient has any appointment with doctorId == doctor
     * - Doctor -> Patient: allowed if patient has any appointment with doctorId == doctor
     * - Admin: allowed
     */
    @Override
    public boolean canInitiate(String initiatorId, String receiverId) {
        String from = normalize(initiatorId);
        String to = normalize(receiverId);
        if (from.isEmpty() || to.isEmpty()) return false;

        UserEntity initiator = userRepository.findById(from).orElse(null);
        UserEntity receiver = userRepository.findById(to).orElse(null);
        if (initiator == null || receiver == null) return false;

        if (initiator.getRole() == UserRole.ADMIN || receiver.getRole() == UserRole.ADMIN) {
            return true;
        }

        if (initiator.getRole() == UserRole.PATIENT && receiver.getRole() == UserRole.DOCTOR) {
            return patientHasAppointmentWithDoctor(from, to);
        }
        if (initiator.getRole() == UserRole.DOCTOR && receiver.getRole() == UserRole.PATIENT) {
            return patientHasAppointmentWithDoctor(to, from);
        }
        return false;
    }

    private boolean patientHasAppointmentWithDoctor(String patientId, String doctorId) {
        var page = appointmentRepository.findByCreatedBy(patientId, PageRequest.of(0, 50));
        return page.stream().anyMatch(a -> doctorId.equals(normalize(a.getDoctorId())));
    }

    private String normalize(String v) {
        return Objects.toString(v, "").trim();
    }
}

