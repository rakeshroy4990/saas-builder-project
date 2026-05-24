/** Matches backend `app.video.join-call-allowed-statuses` (CONFIRMED, Open). */
export const VIDEO_CALLABLE_STATUSES = new Set(['CONFIRMED', 'OPEN']);

/** Matches backend default `app.video.join-call-grace-minutes`. */
export const VIDEO_JOIN_CALL_GRACE_MS = 10 * 60 * 1000;

/** Hospital wall-clock zone — keep aligned with backend `APP_HOSPITAL_TIME_ZONE`. */
export const HOSPITAL_TIME_ZONE = 'UTC';

export type AppointmentSlotWindow = {
  startMs: number;
  endMs: number;
};

/**
 * Parses `PreferredDate` + `PreferredTimeSlot` (`HH:mm-HH:mm`) in hospital time (UTC by default).
 * Mirrors {@link AppointmentCallSlotParser} on the backend.
 */
export function parseAppointmentSlotWindow(
  preferredDate: string,
  preferredTimeSlot: string,
  timeZone = HOSPITAL_TIME_ZONE
): AppointmentSlotWindow | null {
  const date = String(preferredDate ?? '').trim().slice(0, 10);
  const slot = String(preferredTimeSlot ?? '').trim();
  const match = slot.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!date || !match) return null;

  const startParts = match[1].split(':').map((n) => Number(n));
  const endParts = match[2].split(':').map((n) => Number(n));
  if (startParts.some((n) => !Number.isFinite(n)) || endParts.some((n) => !Number.isFinite(n))) {
    return null;
  }

  const [y, mo, d] = date.split('-').map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;

  const startMs = zonedWallClockToUtcMs(y, mo, d, startParts[0], startParts[1], timeZone);
  const endMs = zonedWallClockToUtcMs(y, mo, d, endParts[0], endParts[1], timeZone);
  if (startMs == null || endMs == null || startMs >= endMs) return null;
  return { startMs, endMs };
}

function zonedWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number | null {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(guess, timeZone);
  if (offsetMs == null) return null;
  return guess - offsetMs;
}

function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const y = read('year');
    const mo = read('month');
    const d = read('day');
    const h = read('hour');
    const mi = read('minute');
    const s = read('second');
    if ([y, mo, d, h, mi, s].some((n) => !Number.isFinite(n))) return null;
    const asUtc = Date.UTC(y, mo - 1, d, h, mi, s, 0);
    return asUtc - utcMs;
  } catch {
    return null;
  }
}

export function isWithinVideoCallWindow(
  preferredDate: string,
  preferredTimeSlot: string,
  nowMs = Date.now(),
  graceMs = VIDEO_JOIN_CALL_GRACE_MS,
  timeZone = HOSPITAL_TIME_ZONE
): boolean {
  const window = parseAppointmentSlotWindow(preferredDate, preferredTimeSlot, timeZone);
  if (!window) return false;
  return nowMs >= window.startMs - graceMs && nowMs <= window.endMs + graceMs;
}

export function isVideoCallableStatus(status: string): boolean {
  return VIDEO_CALLABLE_STATUSES.has(String(status ?? '').trim().toUpperCase());
}
