package com.flexshell.email;

import com.flexshell.controller.dto.AppointmentResponse;

import java.util.Objects;

/**
 * JSON body for {@code POST /hospital/appointment-created} (camelCase for Node).
 */
public record AppointmentCreatedEmailRequest(
        String appointmentId,
        String patientName,
        String patientEmail,
        String patientPhone,
        String doctorName,
        String doctorEmail,
        String department,
        String preferredDate,
        String preferredTimeSlot,
        String additionalNotes,
        String appBaseUrl
) {
    public static AppointmentCreatedEmailRequest from(
            AppointmentResponse appointment,
            String doctorEmail,
            String appBaseUrl
    ) {
        return new AppointmentCreatedEmailRequest(
                nz(appointment.id()),
                nz(appointment.patientName()),
                nz(appointment.email()),
                nz(appointment.phoneNumber()),
                nz(appointment.doctorName()),
                nz(doctorEmail),
                nz(appointment.department()),
                nz(appointment.preferredDate()),
                nz(appointment.preferredTimeSlot()),
                nz(appointment.additionalNotes()),
                nz(appBaseUrl)
        );
    }

    private static String nz(String value) {
        return Objects.toString(value, "").trim();
    }
}
