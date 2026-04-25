"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPOINTMENT_CREATED_HTML_TO_DOCTOR = exports.APPOINTMENT_CREATED_HTML_TO_PATIENT = exports.APPOINTMENT_CREATED_DETAIL_ROW_HTML = exports.APPOINTMENT_CREATED_EMAIL_STYLES = exports.APPOINTMENT_EMAIL_DATA_FLOW = exports.APPOINTMENT_EMAIL_DOM_IDS = void 0;
/**
 * Appointment-created email HTML: stable ids, data attributes, and templates.
 * Customize branding/layout here; wire behavior via {@link APPOINTMENT_EMAIL_DOM_IDS} and `data-email-flow`.
 *
 * Dynamic segments use `{{PLACEHOLDER}}` tokens filled by `appointmentCreatedFlowHtml.ts`.
 */
exports.APPOINTMENT_EMAIL_DOM_IDS = {
    /** Root wrapper — patient copy */
    rootToPatient: 'email-hospital-appt-created--to-patient',
    /** Root wrapper — doctor copy */
    rootToDoctor: 'email-hospital-appt-created--to-doctor',
    /** Summary table — patient message */
    detailsTableToPatient: 'email-hospital-appt-created--details-to-patient',
    /** Summary table — doctor message */
    detailsTableToDoctor: 'email-hospital-appt-created--details-to-doctor',
    /** Primary CTA — patient message */
    dashboardLinkToPatient: 'email-hospital-appt-created--dashboard-to-patient',
    /** Primary CTA — doctor message */
    dashboardLinkToDoctor: 'email-hospital-appt-created--dashboard-to-doctor',
    /** Reference code — patient message */
    referenceCodeToPatient: 'email-hospital-appt-created--reference-to-patient',
    /** Reference code — doctor message */
    referenceCodeToDoctor: 'email-hospital-appt-created--reference-to-doctor',
};
/** Mirrors {@link AppointmentEmailFlow} values for DOM; keep in sync with flow enum. */
exports.APPOINTMENT_EMAIL_DATA_FLOW = {
    ToPatient: 'ToPatient',
    ToDoctor: 'ToDoctor',
};
exports.APPOINTMENT_CREATED_EMAIL_STYLES = {
    root: 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#111827;line-height:1.5;max-width:560px',
    table: 'border-collapse:collapse;width:100%;margin:0 0 20px',
    code: 'background:#f3f4f6;padding:2px 6px;border-radius:4px',
    footerNote: 'margin:24px 0 0;font-size:13px;color:#6b7280',
    link: 'color:#2563eb',
    detailRowBgEven: '#ffffff',
    detailRowBgOdd: '#f6f7f9',
};
/**
 * Single detail row; `{{ROW_BG}}`, `{{LABEL}}`, `{{VALUE}}` are pre-escaped at assembly time.
 */
exports.APPOINTMENT_CREATED_DETAIL_ROW_HTML = `<tr data-appt-detail-row data-email-part="detail-row" style="background:{{ROW_BG}}"><td style="padding:10px 12px;font-weight:600;width:140px;border:1px solid #e5e7eb">{{LABEL}}</td><td style="padding:10px 12px;border:1px solid #e5e7eb">{{VALUE}}</td></tr>`;
const S = exports.APPOINTMENT_CREATED_EMAIL_STYLES;
/**
 * Patient-facing HTML shell. Placeholders: {{DETAIL_ROWS}}, {{SAFE_PATIENT}}, {{SAFE_DOCTOR}}, {{APPT_ID}}, {{DASHBOARD_HREF}}
 */
exports.APPOINTMENT_CREATED_HTML_TO_PATIENT = `<div id="${exports.APPOINTMENT_EMAIL_DOM_IDS.rootToPatient}" data-email-flow="${exports.APPOINTMENT_EMAIL_DATA_FLOW.ToPatient}" data-template="appointment-created" data-template-version="1" style="${S.root}">
  <h2 data-email-part="title" style="margin:0 0 12px">Appointment request received</h2>
  <p data-email-part="greeting" style="margin:0 0 16px">Hi {{SAFE_PATIENT}},</p>
  <p data-email-part="intro" style="margin:0 0 16px">We have received your appointment booking. Here is a summary of what you submitted:</p>
  <table id="${exports.APPOINTMENT_EMAIL_DOM_IDS.detailsTableToPatient}" data-email-part="details" style="${S.table}">{{DETAIL_ROWS}}</table>
  <p data-email-part="doctor-line" style="margin:0 0 12px">Assigned doctor: <strong>{{SAFE_DOCTOR}}</strong></p>
  <p data-email-part="reference-line" style="margin:0 0 20px">Reference: <code id="${exports.APPOINTMENT_EMAIL_DOM_IDS.referenceCodeToPatient}" style="${S.code}">{{APPT_ID}}</code></p>
  <p data-email-part="cta" style="margin:0 0 8px"><a id="${exports.APPOINTMENT_EMAIL_DOM_IDS.dashboardLinkToPatient}" href="{{DASHBOARD_HREF}}" style="${S.link}">Open your dashboard</a> to review or update this appointment.</p>
  <p data-email-part="footer" style="${S.footerNote}">This message was sent automatically. Please do not reply if this inbox is unattended.</p>
</div>`;
/**
 * Doctor-facing HTML shell. Same placeholders as patient where applicable.
 */
exports.APPOINTMENT_CREATED_HTML_TO_DOCTOR = `<div id="${exports.APPOINTMENT_EMAIL_DOM_IDS.rootToDoctor}" data-email-flow="${exports.APPOINTMENT_EMAIL_DATA_FLOW.ToDoctor}" data-template="appointment-created" data-template-version="1" style="${S.root}">
  <h2 data-email-part="title" style="margin:0 0 12px">New appointment booking</h2>
  <p data-email-part="greeting" style="margin:0 0 16px">Hello {{SAFE_DOCTOR}},</p>
  <p data-email-part="intro" style="margin:0 0 16px">A patient has booked an appointment with you. Summary:</p>
  <table id="${exports.APPOINTMENT_EMAIL_DOM_IDS.detailsTableToDoctor}" data-email-part="details" style="${S.table}">{{DETAIL_ROWS}}</table>
  <p data-email-part="reference-line" style="margin:0 0 20px">Reference: <code id="${exports.APPOINTMENT_EMAIL_DOM_IDS.referenceCodeToDoctor}" style="${S.code}">{{APPT_ID}}</code></p>
  <p data-email-part="cta" style="margin:0 0 8px"><a id="${exports.APPOINTMENT_EMAIL_DOM_IDS.dashboardLinkToDoctor}" href="{{DASHBOARD_HREF}}" style="${S.link}">Open hospital dashboard</a> (same portal your patients use).</p>
  <p data-email-part="footer" style="${S.footerNote}">This message was sent automatically from the hospital booking system.</p>
</div>`;
