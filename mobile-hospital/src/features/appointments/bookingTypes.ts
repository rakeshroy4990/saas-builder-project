export type SelectOption = {
  id: string;
  label: string;
  value: string;
};

export type DateAvailabilityRow = {
  date: string;
  dateLabel: string;
  slotCount: number;
};

export type AppointmentBookingForm = {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  ageGroup: string;
  department: string;
  doctorId: string;
  preferredDate: string;
  preferredTimeSlot: string;
  additionalNotes: string;
};

export type PickedPrescriptionImage = {
  uri: string;
  name: string;
  mimeType: string;
};

export const APPOINTMENT_SLOT_LOOKAHEAD_DAYS = 10;
export const MAX_APPOINTMENT_PRESCRIPTION_FILES = 2;
export const MAX_BOOKING_AGE_YEARS = 20;
