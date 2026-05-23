import type { AppointmentSummary } from './types';

function parseTimeToMinutes(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const twentyFour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const hh = Number(twentyFour[1]);
    const mm = Number(twentyFour[2]);
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      return hh * 60 + mm;
    }
  }

  const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!twelveHour) return null;
  let hh = Number(twelveHour[1]);
  const mm = Number(twelveHour[2]);
  const meridiem = String(twelveHour[3]).toUpperCase();
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
  if (meridiem === 'AM') {
    if (hh === 12) hh = 0;
  } else if (hh !== 12) {
    hh += 12;
  }
  return hh * 60 + mm;
}

export function parseAppointmentStartMs(preferredDate: string, preferredTimeSlot: string): number | null {
  const date = String(preferredDate ?? '').trim();
  const slot = String(preferredTimeSlot ?? '').trim();
  if (!date || !slot) return null;
  const firstToken = slot.split(/\s*(?:-|–|—|\bto\b)\s*/i)[0]?.trim() ?? '';
  const minutes = parseTimeToMinutes(firstToken);
  if (minutes == null) return null;
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  day.setMinutes(minutes);
  return day.getTime();
}

export function computeCanStartVideoCall(
  appointment: Pick<AppointmentSummary, 'status' | 'preferredDate' | 'preferredTimeSlot'>,
  role: string,
  myUserId: string,
  createdBy: string
): boolean {
  const statusU = String(appointment.status ?? '').trim().toUpperCase();
  const appointmentStartMs = parseAppointmentStartMs(appointment.preferredDate, appointment.preferredTimeSlot);
  const baseCanStartVideoCall =
    statusU !== 'CANCELLED' &&
    statusU !== 'COMPLETED' &&
    statusU !== 'DELETED' &&
    appointmentStartMs != null &&
    Date.now() >= appointmentStartMs - 15 * 60 * 1000;
  const adminCreatedThisAppointment =
    role === 'ADMIN' &&
    Boolean(myUserId && createdBy && createdBy.toLowerCase() === myUserId.toLowerCase());
  return role === 'ADMIN' ? baseCanStartVideoCall && adminCreatedThisAppointment : baseCanStartVideoCall;
}
