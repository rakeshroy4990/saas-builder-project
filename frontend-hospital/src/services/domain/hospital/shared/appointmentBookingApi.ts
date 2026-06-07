import { isAxiosError } from 'axios';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { APPOINTMENT_SLOT_LOOKAHEAD_DAYS } from './appointmentAvailabilityConfig';
import { pickString } from './strings';

export type DateAvailabilityRow = {
  date: string;
  dateLabel: string;
  slotCount: number;
};

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

function buildSlotSummary(slotCounts: DateAvailabilityRow[]): string {
  if (slotCounts.length === 0) return '';
  return slotCounts.map((row) => `${row.dateLabel}: ${row.slotCount}`).join(' | ');
}

function parseDateAvailabilityPayload(raw: unknown): DateAvailabilityRow[] {
  const envelope = (raw ?? {}) as Record<string, unknown>;
  const dataNode = (envelope.Data ?? envelope.data ?? {}) as Record<string, unknown>;
  const daysRaw = dataNode.Days ?? dataNode.days ?? [];
  if (!Array.isArray(daysRaw)) return [];
  return daysRaw
    .map((row) => {
      const node = (row ?? {}) as Record<string, unknown>;
      const date = pickString(node, ['Date', 'date']).trim();
      const slotCountRaw = node.SlotCount ?? node.slotCount ?? 0;
      const slotCount =
        typeof slotCountRaw === 'number' && Number.isFinite(slotCountRaw)
          ? Math.max(0, Math.floor(slotCountRaw))
          : 0;
      if (!date) return null;
      return { date, dateLabel: toReadableDateLabel(date), slotCount };
    })
    .filter((row): row is DateAvailabilityRow => row !== null);
}

export function mapDoctorOptionsFromWire(rows: unknown[]): Array<{ id: string; label: string; value: string }> {
  return rows
    .map((item, idx) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const id = pickString(record, ['Id', 'id']) || `doctor-${idx}`;
      const firstName = pickString(record, ['FirstName', 'firstName']);
      const lastName = pickString(record, ['LastName', 'lastName']);
      const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const name = pickString(record, ['Name', 'name']) || combinedName;
      const degree = pickString(record, ['Qualifications', 'qualifications', 'Degree', 'degree']);
      const label = [name, degree ? `(${degree})` : ''].filter(Boolean).join(' ').trim();
      return { id, label: label || id, value: id };
    })
    .filter((option) => option.label.trim().length > 0);
}

export async function fetchBookingDateAvailability(
  doctorId: string,
  options?: { lookaheadDays?: number; excludeAppointmentId?: string }
): Promise<{ slotCounts: DateAvailabilityRow[]; unavailableDates: string[]; summaryText: string }> {
  const lookaheadDays = options?.lookaheadDays ?? APPOINTMENT_SLOT_LOOKAHEAD_DAYS;
  const excludeAppointmentId = String(options?.excludeAppointmentId ?? '').trim();
  try {
    const response = await apiClient.get(URLRegistry.paths.appointmentBookingDateAvailability, {
      params: {
        doctorId,
        lookaheadDays,
        ...(excludeAppointmentId ? { excludeAppointmentId } : {})
      }
    });
    const slotCounts = parseDateAvailabilityPayload(response.data);
    const unavailableDates = slotCounts.filter((row) => row.slotCount === 0).map((row) => row.date);
    return { slotCounts, unavailableDates, summaryText: buildSlotSummary(slotCounts) };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      const slotCounts: DateAvailabilityRow[] = [];
      return { slotCounts, unavailableDates: [], summaryText: '' };
    }
    throw error;
  }
}

export type BookingFormContextResult = {
  doctors: Array<{ id: string; label: string; value: string }>;
  dateAvailability: {
    slotCounts: DateAvailabilityRow[];
    unavailableDates: string[];
    summaryText: string;
  };
};

export async function fetchBookingFormContext(options: {
  department?: string;
  doctorId?: string;
  lookaheadDays?: number;
  excludeAppointmentId?: string;
}): Promise<BookingFormContextResult> {
  const department = String(options.department ?? '').trim();
  const doctorId = String(options.doctorId ?? '').trim();
  const lookaheadDays = options.lookaheadDays ?? APPOINTMENT_SLOT_LOOKAHEAD_DAYS;
  const excludeAppointmentId = String(options.excludeAppointmentId ?? '').trim();
  const response = await apiClient.get(URLRegistry.paths.appointmentBookingFormContext, {
    params: {
      ...(department ? { department } : {}),
      ...(doctorId ? { doctorId } : {}),
      lookaheadDays,
      ...(excludeAppointmentId ? { excludeAppointmentId } : {})
    }
  });
  const envelope = (response.data ?? {}) as Record<string, unknown>;
  const dataNode = (envelope.Data ?? envelope.data ?? {}) as Record<string, unknown>;
  const doctorsRaw = dataNode.Doctors ?? dataNode.doctors ?? [];
  const doctors = Array.isArray(doctorsRaw) ? mapDoctorOptionsFromWire(doctorsRaw) : [];
  const availabilityRaw = dataNode.DateAvailability ?? dataNode.dateAvailability ?? {};
  const slotCounts = parseDateAvailabilityPayload({ Data: availabilityRaw });
  const unavailableDates = slotCounts.filter((row) => row.slotCount === 0).map((row) => row.date);
  return {
    doctors,
    dateAvailability: {
      slotCounts,
      unavailableDates,
      summaryText: buildSlotSummary(slotCounts)
    }
  };
}
