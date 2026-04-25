package com.flexshell.email;

/**
 * Result of attempting appointment-created emails; used to persist status on {@link com.flexshell.appointment.AppointmentEntity}
 * without affecting the appointment save transaction.
 */
public record AppointmentEmailNotifyOutcome(
        String status,
        boolean failed,
        String detail
) {
    public static final String STATUS_SKIPPED = "SKIPPED";
    public static final String STATUS_SUCCESS = "SUCCESS";
    public static final String STATUS_PARTIAL = "PARTIAL";
    public static final String STATUS_FAILED = "FAILED";

    public static AppointmentEmailNotifyOutcome skipped(String detail) {
        return new AppointmentEmailNotifyOutcome(STATUS_SKIPPED, false, detail);
    }

    public static AppointmentEmailNotifyOutcome failed(String detail) {
        return new AppointmentEmailNotifyOutcome(STATUS_FAILED, true, detail);
    }

    public static AppointmentEmailNotifyOutcome success() {
        return new AppointmentEmailNotifyOutcome(STATUS_SUCCESS, false, null);
    }

    public static AppointmentEmailNotifyOutcome partial(String detail) {
        return new AppointmentEmailNotifyOutcome(STATUS_PARTIAL, true, detail);
    }
}
