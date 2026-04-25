package com.flexshell.email;

import com.flexshell.controller.dto.AppointmentResponse;

/**
 * Triggers appointment-created emails (patient + doctor) via the email-notify HTTP bridge.
 */
public interface AppointmentCreatedEmailNotifier {

    /**
     * Attempts to send appointment-created emails. Implementations must not throw;
     * failures are represented in the returned {@link AppointmentEmailNotifyOutcome}.
     */
    AppointmentEmailNotifyOutcome notifyAppointmentCreated(AppointmentResponse appointment, String doctorEmail);
}
