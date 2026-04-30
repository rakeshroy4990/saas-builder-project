import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { pickString } from './strings';

function mapAvailableSlotsPayload(raw: unknown): { usesSchedule: boolean; list: Array<{ id: string; label: string; value: string }> } {
  const node = (raw ?? {}) as Record<string, unknown>;
  const usesSchedule = Boolean(node.UsesSchedule ?? node.usesSchedule);
  const slotsRaw = node.Slots ?? node.slots ?? [];
  const slots = Array.isArray(slotsRaw) ? (slotsRaw as unknown[]) : [];
  const list = slots.map((row, idx) => {
    const o = (row ?? {}) as Record<string, unknown>;
    const value = pickString(o, ['Value', 'value']).trim();
    const label = pickString(o, ['Label', 'label']).trim() || value;
    return { id: value || `slot-${idx}`, label: label || value, value };
  }).filter((x) => x.value.length > 0);
  return { usesSchedule, list };
}

const emptySlots = { list: [] as Array<{ id: string; label: string; value: string }> };

const NO_SLOTS_MESSAGE =
  'No time slots are available for this doctor on the selected date. Please choose a different doctor or date.';
const NO_FUTURE_SLOTS_TODAY_MESSAGE =
  'No future time slots are available today. Please choose a later date.';

function toIsoLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

function keepOnlyFutureSlotsForToday(
  selectedDateIso: string,
  slots: Array<{ id: string; label: string; value: string }>
): Array<{ id: string; label: string; value: string }> {
  if (selectedDateIso !== toIsoLocalDate(new Date())) {
    return slots;
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => {
    const slotStartMinutes = parseSlotStartMinutes(slot.value);
    if (slotStartMinutes == null) return true;
    return slotStartMinutes > nowMinutes;
  });
}

/**
 * Loads bookable slots for doctor + date via {@link URLRegistry.paths.appointmentBookingAvailableSlots}
 * (doctor schedule minus open appointments) into `AppointmentTimeSlots`.
 */
export async function refreshAppointmentTimeSlotOptionsFromForm(): Promise<void> {
  const appStore = useAppStore(pinia);
  const toast = useToastStore(pinia);
  const form = (appStore.getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;
  const doctorId = pickString(form, ['doctor', 'DoctorId']).trim();
  const date = pickString(form, ['preferredDate', 'PreferredDate']).trim();
  const excludeId = pickString(form, ['editingAppointmentId']).trim();

  appStore.setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', '');

  if (!doctorId || !date) {
    appStore.setData('hospital', 'AppointmentTimeSlots', emptySlots);
    return;
  }

  try {
    const response = await apiClient.get(URLRegistry.paths.appointmentBookingAvailableSlots, {
      params: {
        doctorId,
        date,
        ...(excludeId ? { excludeAppointmentId: excludeId } : {})
      }
    });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = envelope.Data ?? envelope.data ?? {};
    const { list } = mapAvailableSlotsPayload(dataNode);
    const filteredList = keepOnlyFutureSlotsForToday(date, list);
    appStore.setData('hospital', 'AppointmentTimeSlots', { list: filteredList });

    if (list.length === 0) {
      appStore.setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', NO_SLOTS_MESSAGE);
    } else if (filteredList.length === 0) {
      appStore.setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', NO_FUTURE_SLOTS_TODAY_MESSAGE);
    }

    const currentSlot = pickString(form, ['preferredTimeSlot', 'PreferredTimeSlot']).trim();
    if (currentSlot && !filteredList.some((o) => o.value === currentSlot)) {
      appStore.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
    }
  } catch (error) {
    appStore.setData('hospital', 'AppointmentTimeSlots', emptySlots);
    const currentSlot = pickString(form, ['preferredTimeSlot', 'PreferredTimeSlot']).trim();
    if (currentSlot) {
      appStore.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
    }
    if (isAxiosError(error) && error.response?.status === 403) {
      toast.show('You cannot load slots for this doctor.', 'info');
      return;
    }
    toast.show('Could not load available time slots. Try again.', 'error');
  }
}
