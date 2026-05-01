import { AppointmentSavePayload } from '../types';
import { withBrandShell } from './brand-shell';

export function buildAppointmentSaveEmail(payload: AppointmentSavePayload) {
  const formattedDate = new Date(payload.appointmentDate).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const contentHtml = `
    <h2>Appointment Confirmed</h2>
    <p>Hi ${payload.userName},</p>
    <p>Your appointment has been saved.</p>
    <table style="border-collapse:collapse;width:100%;max-width:480px">
      <tr><td style="padding:8px;font-weight:bold">Title</td><td style="padding:8px">${payload.appointmentTitle}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Date & Time</td><td style="padding:8px">${formattedDate}</td></tr>
      ${
        payload.location
          ? `<tr><td style="padding:8px;font-weight:bold">Location</td><td style="padding:8px">${payload.location}</td></tr>`
          : ''
      }
      ${
        payload.notes
          ? `<tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Notes</td><td style="padding:8px">${payload.notes}</td></tr>`
          : ''
      }
    </table>
    <p>Appointment ID: <code>${payload.appointmentId}</code></p>
  `;
  const html = withBrandShell(contentHtml, '');

  return {
    subject: `Appointment Confirmed: ${payload.appointmentTitle}`,
    html,
    text: `Appointment confirmed: ${payload.appointmentTitle} on ${formattedDate}`,
  };
}
