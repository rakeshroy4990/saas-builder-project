/** Master grid for Book An Appointment (values must match backend PreferredTimeSlot strings). */
export const MASTER_TIME_SLOT_OPTIONS: Array<{ id: string; label: string; value: string }> = [
  { id: 't1000', label: '10:00 AM - 10:15 AM', value: '10:00-10:15' },
  { id: 't1015', label: '10:15 AM - 10:30 AM', value: '10:15-10:30' },
  { id: 't1030', label: '10:30 AM - 10:45 AM', value: '10:30-10:45' },
  { id: 't1045', label: '10:45 AM - 11:00 AM', value: '10:45-11:00' },
  { id: 't1100', label: '11:00 AM - 11:15 AM', value: '11:00-11:15' },
  { id: 't1115', label: '11:15 AM - 11:30 AM', value: '11:15-11:30' },
  { id: 't1130', label: '11:30 AM - 11:45 AM', value: '11:30-11:45' },
  { id: 't1145', label: '11:45 AM - 12:00 PM', value: '11:45-12:00' },
  { id: 't1200', label: '12:00 PM - 12:15 PM', value: '12:00-12:15' },
  { id: 't1215', label: '12:15 PM - 12:30 PM', value: '12:15-12:30' },
  { id: 't1230', label: '12:30 PM - 12:45 PM', value: '12:30-12:45' },
  { id: 't1245', label: '12:45 PM - 01:00 PM', value: '12:45-13:00' }
];

export function buildAvailableSlotOptions(occupiedSlotValues: string[]): Array<{ id: string; label: string; value: string }> {
  const occ = new Set(occupiedSlotValues.map((s) => String(s ?? '').trim()).filter(Boolean));
  return MASTER_TIME_SLOT_OPTIONS.filter((o) => !occ.has(o.value));
}
