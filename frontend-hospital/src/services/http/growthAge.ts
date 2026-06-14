export type AgeComponents = {
  years: number;
  months: number;
  days: number;
};

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function recordedAtToYmd(recordedAt: string): string {
  const trimmed = String(recordedAt ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return '';
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

export function computeAgeAtDate(dateOfBirth: string, recordedAt: string): AgeComponents | null {
  const dob = parseYmd(dateOfBirth);
  const recorded = parseYmd(recordedAtToYmd(recordedAt));
  if (!dob || !recorded) return null;

  let years = recorded.y - dob.y;
  let months = recorded.m - dob.m;
  let days = recorded.d - dob.d;

  if (days < 0) {
    months -= 1;
    const prevMonth = recorded.m === 1 ? 12 : recorded.m - 1;
    const prevMonthYear = recorded.m === 1 ? recorded.y - 1 : recorded.y;
    days += daysInMonth(prevMonthYear, prevMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return { years, months, days };
}

export function formatAgeAtRecordingLabel(
  dateOfBirth: string,
  recordedAt: string,
  t: (key: string, values?: Record<string, unknown>) => string
): string | null {
  const age = computeAgeAtDate(dateOfBirth, recordedAt);
  if (!age) return null;
  return t('growth.historyAge', age);
}
