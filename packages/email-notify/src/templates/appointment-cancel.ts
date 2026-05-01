import { AppointmentCancelPayload } from '../types';
import { withBrandShell } from './brand-shell';

export function buildAppointmentCancelEmail(payload: AppointmentCancelPayload) {
  const formattedDate = new Date(payload.appointmentDate).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const contentHtml = `
    <h2>Appointment Cancelled</h2>
    <p>Hi ${payload.userName},</p>
    <p>Your appointment has been cancelled.</p>
    <table style="border-collapse:collapse;width:100%;max-width:480px">
      <tr><td style="padding:8px;font-weight:bold">Title</td><td style="padding:8px">${payload.appointmentTitle}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Was Scheduled</td><td style="padding:8px">${formattedDate}</td></tr>
      ${
        payload.cancellationReason
          ? `<tr><td style="padding:8px;font-weight:bold">Reason</td><td style="padding:8px">${payload.cancellationReason}</td></tr>`
          : ''
      }
    </table>
    <p>Appointment ID: <code>${payload.appointmentId}</code></p>
    <p>If this was a mistake, please reschedule through your portal.</p>
  `;
  const html = withBrandShell(contentHtml, '');

  return {
    subject: `Appointment Cancelled: ${payload.appointmentTitle}`,
    html,
    text: `Appointment "${payload.appointmentTitle}" on ${formattedDate} has been cancelled.`,
  };
}
