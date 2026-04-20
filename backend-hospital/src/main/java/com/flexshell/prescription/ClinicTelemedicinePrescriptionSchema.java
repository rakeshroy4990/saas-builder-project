package com.flexshell.prescription;

/**
 * <p>Engineering checklist for a clinic post-consultation structured prescription aligned to common
 * telemedicine documentation expectations (e.g. MoHFW Telemedicine Practice Guidelines, 2020 annexure).
 * This is <strong>not legal advice</strong>. Product, security, and health-law counsel must approve field
 * parity, Drugs and Cosmetics Act schedules (H / H1 / X) handling, cross-state practice, retention, and
 * any electronic signature or DSC / eSign ASP integration before production use.</p>
 *
 * <p>The {@value #TEMPLATE_VERSION} payload shape and PDF layout are versioned together; bump the
 * template when changing mandatory fields or rendering.</p>
 */
public final class ClinicTelemedicinePrescriptionSchema {

    public static final String TEMPLATE_VERSION = "1";

    /** Root keys in the persisted JSON payload (draft and signed snapshot). */
    public static final String KEY_TEMPLATE_VERSION = "templateVersion";
    public static final String KEY_CONSULTATION_DATE_TIME = "consultationDateTime";
    public static final String KEY_CONSULTATION_MODE = "consultationMode";
    public static final String KEY_CLINIC = "clinic";
    public static final String KEY_PRESCRIBER = "prescriber";
    public static final String KEY_PATIENT = "patient";
    public static final String KEY_MEDICINES = "medicines";
    public static final String KEY_GENERAL_ADVICE = "generalAdvice";
    public static final String KEY_FOLLOW_UP_ADVICE = "followUpAdvice";

    public static final String KEY_CLINIC_NAME = "name";
    public static final String KEY_CLINIC_ADDRESS = "address";
    public static final String KEY_CLINIC_PHONE = "phone";

    public static final String KEY_PRESCRIBER_DISPLAY_NAME = "displayName";
    public static final String KEY_PRESCRIBER_QUALIFICATIONS = "qualifications";
    public static final String KEY_PRESCRIBER_SMC_NAME = "smcName";
    public static final String KEY_PRESCRIBER_SMC_REGISTRATION = "smcRegistrationNumber";

    public static final String KEY_PATIENT_NAME = "name";
    public static final String KEY_PATIENT_AGE_OR_DOB = "ageOrDob";
    public static final String KEY_PATIENT_SEX = "sex";
    public static final String KEY_PATIENT_ADDRESS = "address";
    public static final String KEY_PATIENT_PHONE = "phone";

    public static final String KEY_MED_NAME = "name";
    public static final String KEY_MED_STRENGTH = "strength";
    public static final String KEY_MED_DOSE = "dose";
    public static final String KEY_MED_FREQUENCY = "frequency";
    public static final String KEY_MED_ROUTE = "route";
    public static final String KEY_MED_DURATION_DAYS = "durationDays";
    public static final String KEY_MED_INSTRUCTIONS = "instructions";
    /** Optional: H, H1, X — product rules must be counsel-approved before allowing these. */
    public static final String KEY_MED_SCHEDULE_CATEGORY = "scheduleCategory";

    private ClinicTelemedicinePrescriptionSchema() {}
}
