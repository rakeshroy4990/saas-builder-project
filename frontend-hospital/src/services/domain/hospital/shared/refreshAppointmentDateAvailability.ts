import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { pickString } from './strings';
import { APPOINTMENT_SLOT_LOOKAHEAD_DAYS } from './appointmentAvailabilityConfig';

type DateAvailabilityRow = {
  date: string;
  dateLabel: string;
  slotCount: number;
};

function toIsoLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildLookaheadDates(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(toIsoLocalDate(d));
  }
  return out;
}

function toReadableDateLabel(isoDate: string): string {
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

function parseSlotStartMinutes(slotValue: string): number | null {
  const value = String(slotValue ?? '').trim();
  const dash = value.indexOf('-');
  const start = (dash >= 0 ? value.slice(0, dash) : value).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(start);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function countFutureSlotsForToday(raw: unknown, targetIsoDate: string): number {
  const todayIso = toIsoLocalDate(new Date());
  if (targetIsoDate !== todayIso) {
    return countSlotsFromResponse(raw);
  }
  const envelope = (raw ?? {}) as Record<string, unknown>;
  const dataNode = (envelope.Data ?? envelope.data ?? {}) as Record<string, unknown>;
  const slotsRaw = dataNode.Slots ?? dataNode.slots ?? [];
  const slots = Array.isArray(slotsRaw) ? (slotsRaw as unknown[]) : [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

function buildSlotSummary(slotCounts: DateAvailabilityRow[]): string {
  if (slotCounts.length === 0) return '';
  return slotCounts.map((row) => `${row.dateLabel}: ${row.slotCount}`).join(' | ');
}

export async function refreshAppointmentDateAvailabilityFromForm(): Promise<void> {
  const appStore = useAppStore(pinia);
  const form = (appStore.getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;
  const doctorId = pickString(form, ['doctor', 'DoctorId']).trim();
  const excludeId = pickString(form, ['editingAppointmentId']).trim();

  if (!doctorId) {
    appStore.setData('hospital', 'AppointmentDateAvailability', {
      unavailableDates: [],
      slotCounts: [] as DateAvailabilityRow[],
      summaryText: ''
    });
    return;
  }

  const nextDates = buildLookaheadDates(APPOINTMENT_SLOT_LOOKAHEAD_DAYS);
  const slotCounts: DateAvailabilityRow[] = [];

  for (const date of nextDates) {
    try {
      const response = await apiClient.get(URLRegistry.paths.appointmentBookingAvailableSlots, {
        params: {
          doctorId,
          date,
          ...(excludeId ? { excludeAppointmentId: excludeId } : {})
        }
      });
      slotCounts.push({
        date,
        dateLabel: toReadableDateLabel(date),
        slotCount: countFutureSlotsForToday(response.data, date)
      });
    } catch (error) {
      // Keep date selectable when availability check fails to avoid blocking booking.
      if (isAxiosError(error) && error.response?.status === 403) {
        slotCounts.push({ date, dateLabel: toReadableDateLabel(date), slotCount: 0 });
      } else {
        slotCounts.push({ date, dateLabel: toReadableDateLabel(date), slotCount: 1 });
      }
    }
  }

  const unavailableDates = slotCounts.filter((row) => row.slotCount === 0).map((row) => row.date);
  const summaryText = buildSlotSummary(slotCounts);
  appStore.setData('hospital', 'AppointmentDateAvailability', { unavailableDates, slotCounts, summaryText });
}
