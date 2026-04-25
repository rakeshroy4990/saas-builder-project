"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentEmailFlow = void 0;
exports.buildAppointmentCreatedHtml = buildAppointmentCreatedHtml;
exports.buildAppointmentCreatedPlainText = buildAppointmentCreatedPlainText;
exports.subjectForAppointmentCreated = subjectForAppointmentCreated;
const appointmentCreatedEmailHtml_constants_1 = require("./appointmentCreatedEmailHtml.constants");
exports.AppointmentEmailFlow = {
    ToPatient: 'ToPatient',
    ToDoctor: 'ToDoctor',
};
function escapeHtml(raw) {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function fillTemplate(template, vars) {
    let out = template;
    for (const [key, value] of Object.entries(vars)) {
        out = out.split(`{{${key}}}`).join(value);
    }
    return out;
}
function formatWhen(ctx) {
    const date = String(ctx.preferredDate ?? '').trim();
    const slot = String(ctx.preferredTimeSlot ?? '').trim();
    if (date && slot) {
        return `${date} · ${slot}`;
    }
    return date || slot || '—';
}
function portalBaseUrl(appBaseUrl) {
    return String(appBaseUrl ?? '').replace(/\/+$/, '');
}
function patientDashboardHref(ctx) {
    const base = portalBaseUrl(ctx.appBaseUrl);
    if (!base) {
        return '#';
    }
    return `${base}/page/hospital/dashboard`;
}
function formatOrderStyleReference(appointmentId) {
    const raw = String(appointmentId ?? '').trim();
    if (!raw) {
        return '0000000000';
    }
    const numericOnly = raw.replace(/\D/g, '');
    if (numericOnly) {
        return numericOnly.slice(-10).padStart(10, '0');
    }
    const hexOnly = raw.replace(/[^a-fA-F0-9]/g, '');
    if (hexOnly) {
        try {
            const mod = 10000000000n;
            const folded = (BigInt(`0x${hexOnly}`) % mod).toString();
            return folded.padStart(10, '0');
        }
        catch {
            // Fall through to char-code fold if BigInt parse fails unexpectedly.
        }
    }
    let hash = 0n;
    for (let i = 0; i < raw.length; i += 1) {
        hash = (hash * 131n + BigInt(raw.charCodeAt(i))) % 10000000000n;
    }
    return hash.toString().padStart(10, '0');
}
function buildDetailRowsHtml(ctx) {
    const { detailRowBgEven, detailRowBgOdd } = appointmentCreatedEmailHtml_constants_1.APPOINTMENT_CREATED_EMAIL_STYLES;
    const rows = [
        { label: 'When', value: escapeHtml(formatWhen(ctx)) },
        { label: 'Department', value: escapeHtml(String(ctx.department ?? '').trim() || '—') },
        { label: 'Patient', value: escapeHtml(String(ctx.patientName ?? '').trim() || '—') },
        { label: 'Patient email', value: escapeHtml(String(ctx.patientEmail ?? '').trim() || '—') },
    ];
    const phone = String(ctx.patientPhone ?? '').trim();
    if (phone) {
        rows.push({ label: 'Patient phone', value: escapeHtml(phone) });
    }
    const notes = String(ctx.additionalNotes ?? '').trim();
    if (notes) {
        rows.push({ label: 'Notes', value: escapeHtml(notes) });
    }
    return rows
        .map((row, i) => fillTemplate(appointmentCreatedEmailHtml_constants_1.APPOINTMENT_CREATED_DETAIL_ROW_HTML, {
        ROW_BG: i % 2 === 0 ? detailRowBgEven : detailRowBgOdd,
        LABEL: row.label,
        VALUE: row.value,
    }))
        .join('');
}
function buildAppointmentCreatedHtml(flow, ctx) {
    const safeDoctor = escapeHtml(String(ctx.doctorName ?? '').trim() || 'your care team');
    const safePatient = escapeHtml(String(ctx.patientName ?? '').trim() || 'there');
    const apptId = escapeHtml(formatOrderStyleReference(String(ctx.appointmentId ?? '').trim()));
    const dashboardHref = escapeHtml(patientDashboardHref(ctx));
    const detailRows = buildDetailRowsHtml(ctx);
    const vars = {
        DETAIL_ROWS: detailRows,
        SAFE_PATIENT: safePatient,
        SAFE_DOCTOR: safeDoctor,
        APPT_ID: apptId,
        DASHBOARD_HREF: dashboardHref,
    };
    const shell = flow === exports.AppointmentEmailFlow.ToPatient
        ? appointmentCreatedEmailHtml_constants_1.APPOINTMENT_CREATED_HTML_TO_PATIENT
        : appointmentCreatedEmailHtml_constants_1.APPOINTMENT_CREATED_HTML_TO_DOCTOR;
    return fillTemplate(shell, vars).trim();
}
function buildAppointmentCreatedPlainText(flow, ctx) {
    const when = formatWhen(ctx);
    const referenceId = formatOrderStyleReference(String(ctx.appointmentId ?? '').trim());
    if (flow === exports.AppointmentEmailFlow.ToPatient) {
        return [
            'Appointment request received',
            '',
            `Hi ${String(ctx.patientName ?? '').trim() || 'there'},`,
            '',
            'We received your booking.',
            `When: ${when}`,
            `Department: ${String(ctx.department ?? '').trim() || '—'}`,
            `Doctor: ${String(ctx.doctorName ?? '').trim() || '—'}`,
            `Reference: ${referenceId}`,
            '',
            `Dashboard: ${patientDashboardHref(ctx)}`,
        ].join('\n');
    }
    return [
        'New appointment booking',
        '',
        `Doctor: ${String(ctx.doctorName ?? '').trim()}`,
        `Patient: ${String(ctx.patientName ?? '').trim()}`,
        `Patient email: ${String(ctx.patientEmail ?? '').trim()}`,
        `Patient phone: ${String(ctx.patientPhone ?? '').trim() || '—'}`,
        `When: ${when}`,
        `Department: ${String(ctx.department ?? '').trim() || '—'}`,
        `Reference: ${referenceId}`,
        '',
        `Notes: ${String(ctx.additionalNotes ?? '').trim() || '—'}`,
    ].join('\n');
}
function subjectForAppointmentCreated(flow, ctx) {
    const dept = String(ctx.department ?? '').trim() || 'Appointment';
    if (flow === exports.AppointmentEmailFlow.ToPatient) {
        return `We received your appointment: ${dept}`;
    }
    return `New booking: ${dept} · ${String(ctx.patientName ?? '').trim() || 'Patient'}`;
}
