import { pickString } from '@saas-builder/hospital-api-client';

import { APPOINTMENT_SLOT_LOOKAHEAD_DAYS, type DateAvailabilityRow } from './bookingTypes';

export function toIsoLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildLookaheadDates(days: number = APPOINTMENT_SLOT_LOOKAHEAD_DAYS): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(toIsoLocalDate(d));
  }
  return out;
}

export function toReadableDateLabel(isoDate: string): string {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function countSlotsFromResponse(raw: unknown): number {
  const envelope = (raw ?? {}) as Record<string, unknown>;
  const dataNode = (envelope.Data ?? envelope.data ?? {}) as Record<string, unknown>;
  const slotsRaw = dataNode.Slots ?? dataNode.slots ?? [];
  const slots = Array.isArray(slotsRaw) ? (slotsRaw as unknown[]) : [];
  return slots
    .map((row) => {
      const node = (row ?? {}) as Record<string, unknown>;
      return pickString(node, ['Value', 'value']).trim();
    })
    .filter((value) => value.length > 0).length;
}

export function parseSlotStartMinutes(slotValue: string): number | null {
  const value = String(slotValue ?? '').trim();
  const dash = value.indexOf('-');
  const start = (dash >= 0 ? value.slice(0, dash) : value).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(start);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function countFutureSlotsForToday(raw: unknown, targetIsoDate: string): number {
  const todayIso = toIsoLocalDate(new Date());
  if (targetIsoDate !== todayIso) {
    return countSlotsFromResponse(raw);
  }
  const envelope = (raw ?? {}) as Record<string, unknown>;
  const dataNode = (envelope.Data ?? envelope.data ?? {}) as Record<string, unknown>;
  const slotsRaw = dataNode.Slots ?? dataNode.slots ?? [];
  const slots = Array.isArray(slotsRaw) ? (slotsRaw as unknown[]) : [];
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return slots
    .map((row) => {
      const node = (row ?? {}) as Record<string, unknown>;
      return pickString(node, ['Value', 'value']).trim();
    })
    .filter((value) => value.length > 0)
    .filter((value) => {
      const startMinutes = parseSlotStartMinutes(value);
      if (startMinutes == null) return true;
      return startMinutes > nowMinutes;
    }).length;
}

export function mapAvailableSlotsPayload(raw: unknown): Array<{ id: string; label: string; value: string }> {
  const node = (raw ?? {}) as Record<string, unknown>;
  const slotsRaw = node.Slots ?? node.slots ?? [];
  const slots = Array.isArray(slotsRaw) ? (slotsRaw as unknown[]) : [];
  return slots
    .map((row, idx) => {
      const o = (row ?? {}) as Record<string, unknown>;
      const value = pickString(o, ['Value', 'value']).trim();
      const label = pickString(o, ['Label', 'label']).trim() || value;
      return { id: value || `slot-${idx}`, label: label || value, value };
    })
    .filter((x) => x.value.length > 0);
}

export function keepOnlyFutureSlotsForToday(
  selectedDateIso: string,
  slots: Array<{ id: string; label: string; value: string }>
): Array<{ id: string; label: string; value: string }> {
  if (selectedDateIso !== toIsoLocalDate(new Date())) {
    return slots;
  }
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return slots.filter((slot) => {
    const start = parseSlotStartMinutes(slot.value);
    if (start == null) return true;
    return start > nowMinutes;
  });
}

export function buildSlotSummary(slotCounts: DateAvailabilityRow[]): string {
  if (slotCounts.length === 0) return '';
  return slotCounts.map((row) => `${row.dateLabel}: ${row.slotCount}`).join(' | ');
}
