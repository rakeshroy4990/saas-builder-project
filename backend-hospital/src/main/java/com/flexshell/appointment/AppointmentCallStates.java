package com.flexshell.appointment;

/**
 * Video call lifecycle on an appointment (separate from booking {@code Status}).
 */
public final class AppointmentCallStates {

    public static final String CALL_INITIATED = "CALL_INITIATED";
    public static final String CALL_IN_PROGRESS = "CALL_IN_PROGRESS";
    public static final String CALL_ENDED = "CALL_ENDED";
    public static final String CALL_DROPPED = "CALL_DROPPED";
    public static final String RECONNECTING = "RECONNECTING";
    public static final String CALL_FAILED = "CALL_FAILED";

    private AppointmentCallStates() {
    }

    public static boolean isTerminal(String callStatus) {
        if (callStatus == null || callStatus.isBlank()) {
            return false;
        }
        String s = callStatus.trim();
        return CALL_ENDED.equalsIgnoreCase(s) || CALL_FAILED.equalsIgnoreCase(s);
    }

    /** Active enough to renew RTC token without re-checking the booking time slot. */
    public static boolean allowsRenewalWithoutSlot(String callStatus) {
        if (callStatus == null || callStatus.isBlank()) {
            return false;
        }
        String s = callStatus.trim();
        return CALL_INITIATED.equalsIgnoreCase(s)
                || CALL_IN_PROGRESS.equalsIgnoreCase(s)
                || RECONNECTING.equalsIgnoreCase(s);
    }
}
