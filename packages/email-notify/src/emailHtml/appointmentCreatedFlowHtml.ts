/**
 * Assembles appointment-created HTML/plain text from templates in
 * `./appointmentCreatedEmailHtml.constants.ts` (stable ids + `data-email-flow` for customization).
 */
import type { AppointmentCreatedEmailContext } from '../types';
import {
  APPOINTMENT_CREATED_DETAIL_ROW_HTML,
  APPOINTMENT_CREATED_EMAIL_STYLES,
  APPOINTMENT_CREATED_HTML_TO_DOCTOR,
  APPOINTMENT_CREATED_HTML_TO_PATIENT,
} from './appointmentCreatedEmailHtml.constants';

export const AppointmentEmailFlow = {
  ToPatient: 'ToPatient',
  ToDoctor: 'ToDoctor',
} as const;

export type AppointmentEmailFlow =
  (typeof AppointmentEmailFlow)[keyof typeof AppointmentEmailFlow];

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

function formatWhen(ctx: AppointmentCreatedEmailContext): string {
  const date = String(ctx.preferredDate ?? '').trim();
  const slot = String(ctx.preferredTimeSlot ?? '').trim();
  if (date && slot) {
    return `${date} · ${slot}`;
  }
  return date || slot || '—';
}

function portalBaseUrl(appBaseUrl: string): string {
  return String(appBaseUrl ?? '').replace(/\/+$/, '');
}

function patientDashboardHref(ctx: AppointmentCreatedEmailContext): string {
  const base = portalBaseUrl(ctx.appBaseUrl);
  if (!base) {
    return '#';
  }
  return `${base}/page/hospital/dashboard`;
}

function formatOrderStyleReference(appointmentId: string): string {
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
      const mod = 10_000_000_000n;
      const folded = (BigInt(`0x${hexOnly}`) % mod).toString();
      return folded.padStart(10, '0');
    } catch {
      // Fall through to char-code fold if BigInt parse fails unexpectedly.
    }
  }

  let hash = 0n;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 131n + BigInt(raw.charCodeAt(i))) % 10_000_000_000n;
  }
  return hash.toString().padStart(10, '0');
}

function buildDetailRowsHtml(ctx: AppointmentCreatedEmailContext): string {
  const { detailRowBgEven, detailRowBgOdd } = APPOINTMENT_CREATED_EMAIL_STYLES;
  const rows: Array<{ label: string; value: string }> = [
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
    .map((row, i) =>
      fillTemplate(APPOINTMENT_CREATED_DETAIL_ROW_HTML, {
        ROW_BG: i % 2 === 0 ? detailRowBgEven : detailRowBgOdd,
        LABEL: row.label,
        VALUE: row.value,
      })
    )
    .join('');
}

export function buildAppointmentCreatedHtml(
  flow: AppointmentEmailFlow,
  ctx: AppointmentCreatedEmailContext
): string {
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

  const shell =
    flow === AppointmentEmailFlow.ToPatient
      ? APPOINTMENT_CREATED_HTML_TO_PATIENT
      : APPOINTMENT_CREATED_HTML_TO_DOCTOR;

  return fillTemplate(shell, vars).trim();
}

export function buildAppointmentCreatedPlainText(
  flow: AppointmentEmailFlow,
  ctx: AppointmentCreatedEmailContext
): string {
  const when = formatWhen(ctx);
  const referenceId = formatOrderStyleReference(String(ctx.appointmentId ?? '').trim());
  if (flow === AppointmentEmailFlow.ToPatient) {
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

export function subjectForAppointmentCreated(
  flow: AppointmentEmailFlow,
  ctx: AppointmentCreatedEmailContext
): string {
  const dept = String(ctx.department ?? '').trim() || 'Appointment';
  if (flow === AppointmentEmailFlow.ToPatient) {
    return `We received your appointment: ${dept}`;
  }
  return `New booking: ${dept} · ${String(ctx.patientName ?? '').trim() || 'Patient'}`;
}
