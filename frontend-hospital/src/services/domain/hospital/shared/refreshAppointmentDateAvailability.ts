import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { pickString } from './strings';
import { APPOINTMENT_SLOT_LOOKAHEAD_DAYS } from './appointmentAvailabilityConfig';
import { fetchBookingDateAvailability } from './appointmentBookingApi';

export async function refreshAppointmentDateAvailabilityFromForm(): Promise<void> {
  const appStore = useAppStore(pinia);
  const form = (appStore.getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;
  const doctorId = pickString(form, ['doctor', 'DoctorId']).trim();
  const excludeId = pickString(form, ['editingAppointmentId']).trim();

  if (!doctorId) {
    appStore.setData('hospital', 'AppointmentDateAvailability', {
      unavailableDates: [],
      slotCounts: [],
      summaryText: ''
    });
    return;
  }

  try {
    const { slotCounts, unavailableDates, summaryText } = await fetchBookingDateAvailability(doctorId, {
      lookaheadDays: APPOINTMENT_SLOT_LOOKAHEAD_DAYS,
      excludeAppointmentId: excludeId || undefined
    });
    appStore.setData('hospital', 'AppointmentDateAvailability', { unavailableDates, slotCounts, summaryText });
  } catch {
    appStore.setData('hospital', 'AppointmentDateAvailability', {
      unavailableDates: [],
      slotCounts: [],
      summaryText: ''
    });
  }
}
