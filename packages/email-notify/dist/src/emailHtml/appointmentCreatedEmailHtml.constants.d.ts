/**
 * Appointment-created email HTML: stable ids, data attributes, and templates.
 * Customize branding/layout here; wire behavior via {@link APPOINTMENT_EMAIL_DOM_IDS} and `data-email-flow`.
 *
 * Dynamic segments use `{{PLACEHOLDER}}` tokens filled by `appointmentCreatedFlowHtml.ts`.
 */
export declare const APPOINTMENT_EMAIL_DOM_IDS: {
    /** Root wrapper — patient copy */
    readonly rootToPatient: "email-hospital-appt-created--to-patient";
    /** Root wrapper — doctor copy */
    readonly rootToDoctor: "email-hospital-appt-created--to-doctor";
    /** Summary table — patient message */
    readonly detailsTableToPatient: "email-hospital-appt-created--details-to-patient";
    /** Summary table — doctor message */
    readonly detailsTableToDoctor: "email-hospital-appt-created--details-to-doctor";
    /** Primary CTA — patient message */
    readonly dashboardLinkToPatient: "email-hospital-appt-created--dashboard-to-patient";
    /** Primary CTA — doctor message */
    readonly dashboardLinkToDoctor: "email-hospital-appt-created--dashboard-to-doctor";
    /** Reference code — patient message */
    readonly referenceCodeToPatient: "email-hospital-appt-created--reference-to-patient";
    /** Reference code — doctor message */
    readonly referenceCodeToDoctor: "email-hospital-appt-created--reference-to-doctor";
};
/** Mirrors {@link AppointmentEmailFlow} values for DOM; keep in sync with flow enum. */
export declare const APPOINTMENT_EMAIL_DATA_FLOW: {
    readonly ToPatient: "ToPatient";
    readonly ToDoctor: "ToDoctor";
};
export declare const APPOINTMENT_CREATED_EMAIL_STYLES: {
    readonly root: "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111827;line-height:1.5;max-width:560px";
    readonly table: "border-collapse:collapse;width:100%;margin:0 0 20px";
    readonly code: "background:#f3f4f6;padding:2px 6px;border-radius:4px";
    readonly footerNote: "margin:24px 0 0;font-size:13px;color:#6b7280";
    readonly link: "color:#2563eb";
    readonly detailRowBgEven: "#ffffff";
    readonly detailRowBgOdd: "#f6f7f9";
};
/**
 * Single detail row; `{{ROW_BG}}`, `{{LABEL}}`, `{{VALUE}}` are pre-escaped at assembly time.
 */
export declare const APPOINTMENT_CREATED_DETAIL_ROW_HTML = "<tr data-appt-detail-row data-email-part=\"detail-row\" style=\"background:{{ROW_BG}}\"><td style=\"padding:10px 12px;font-weight:600;width:140px;border:1px solid #e5e7eb\">{{LABEL}}</td><td style=\"padding:10px 12px;border:1px solid #e5e7eb\">{{VALUE}}</td></tr>";
/**
 * Patient-facing HTML shell. Placeholders: {{DETAIL_ROWS}}, {{SAFE_PATIENT}}, {{SAFE_DOCTOR}}, {{APPT_ID}}, {{DASHBOARD_HREF}}
 */
export declare const APPOINTMENT_CREATED_HTML_TO_PATIENT: string;
/**
 * Doctor-facing HTML shell. Same placeholders as patient where applicable.
 */
export declare const APPOINTMENT_CREATED_HTML_TO_DOCTOR: string;
