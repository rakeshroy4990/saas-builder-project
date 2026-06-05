import {
  isEnvelopeSuccess,
  pickString,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';
import { isAxiosError } from 'axios';

import { toUserFacingApiError } from '@/api/apiErrors';
import { apiClient } from '@/api/client';
import { normalizeUploadMimeType } from '@/api/multipart';

import {
  buildLookaheadDates,
  buildSlotSummary,
  countFutureSlotsForToday,
  keepOnlyFutureSlotsForToday,
  mapAvailableSlotsPayload,
  toReadableDateLabel
} from './appointmentAvailability';
import type {
  AppointmentBookingForm,
  DateAvailabilityRow,
  PickedPrescriptionImage,
  SelectOption
} from './bookingTypes';

export type AppointmentCreatePayload = {
  PatientName: string;
  Email: string;
  PhoneNumber: string;
  AgeGroup: string;
  Department: string;
  DoctorId: string;
  PreferredDate: string;
  PreferredTimeSlot: string;
  AdditionalNotes: string;
};

export function buildAppointmentPayload(form: AppointmentBookingForm): AppointmentCreatePayload {
  return {
    PatientName: form.patientName.trim(),
    Email: form.patientEmail.trim(),
    PhoneNumber: form.patientPhone.trim(),
    AgeGroup: form.ageGroup.trim(),
    Department: form.department.trim(),
    DoctorId: form.doctorId.trim(),
    PreferredDate: form.preferredDate.trim(),
    PreferredTimeSlot: form.preferredTimeSlot.trim(),
    AdditionalNotes: form.additionalNotes.trim()
  };
}

export function validateBookingForm(
  form: AppointmentBookingForm,
  options?: { isEdit?: boolean }
): string[] {
  const payload = buildAppointmentPayload(form);
  const required: Array<{ label: string; value: string }> = [
    { label: 'Patient name', value: payload.PatientName },
    { label: 'Email', value: payload.Email },
    { label: 'Phone number', value: payload.PhoneNumber },
    { label: 'Age', value: payload.AgeGroup },
    { label: 'Department', value: payload.Department },
    { label: 'Doctor', value: payload.DoctorId },
    { label: 'Preferred date', value: payload.PreferredDate },
    { label: 'Preferred time slot', value: payload.PreferredTimeSlot }
  ];
  const missing = required.filter((f) => !f.value).map((f) => f.label);
  if (!options?.isEdit) {
    const ageDigits = payload.AgeGroup.replace(/\D/g, '');
    const ageNum = parseInt(ageDigits, 10);
    if (!Number.isNaN(ageNum) && ageNum > 20) {
      missing.push('Age must be 20 years or less');
    }
  }
  return missing;
}

export async function fetchMedicalDepartments(): Promise<SelectOption[]> {
  const response = await apiClient.get(SERVER_PATHS.medicalDepartmentGet, {
    params: { page: 0, size: 100 }
  });
  const dataNode = unwrapEnvelope<unknown>(response.data);
  if (!Array.isArray(dataNode)) return [];
  return dataNode
    .map((item, idx) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const id = pickString(record, ['Id', 'id']) || `dept-${idx}`;
      const name = pickString(record, ['Name', 'name']);
      const code = pickString(record, ['Code', 'code']);
      const activeRaw = record.Active ?? record.active;
      const active = activeRaw === undefined || activeRaw === true || activeRaw === 'true';
      const label = [name, code ? `(${code})` : ''].filter(Boolean).join(' ').trim();
      return {
        id,
        label: label || id,
        value: code || name || id,
        active
      };
    })
    .filter((row) => row.active !== false && row.label.trim().length > 0)
    .map(({ id, label, value }) => ({ id, label, value }));
}

export async function fetchDoctorsByDepartment(department: string): Promise<SelectOption[]> {
  const response = await apiClient.get(SERVER_PATHS.doctorGet, {
    params: { department, page: 0, size: 100 }
  });
  const dataNode = unwrapEnvelope<unknown>(response.data);
  if (!Array.isArray(dataNode)) return [];
  return dataNode
    .map((item, idx) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const id = pickString(record, ['Id', 'id']) || `doctor-${idx}`;
      const firstName = pickString(record, ['FirstName', 'firstName']);
      const lastName = pickString(record, ['LastName', 'lastName']);
      const name = pickString(record, ['Name', 'name']) || [firstName, lastName].filter(Boolean).join(' ').trim();
      const email = pickString(record, ['Email', 'email']);
      const label = [name, email ? `(${email})` : ''].filter(Boolean).join(' ').trim();
      return { id, label: label || id, value: id };
    })
    .filter((option) => option.label.trim().length > 0);
}

async function fetchAvailableSlotsRaw(
  doctorId: string,
  date: string,
  excludeAppointmentId?: string
): Promise<unknown> {
  const response = await apiClient.get(SERVER_PATHS.appointmentBookingAvailableSlots, {
    params: {
      doctorId,
      date,
      ...(excludeAppointmentId ? { excludeAppointmentId } : {})
    }
  });
  return response.data;
}

export async function fetchDateAvailability(
  doctorId: string,
  excludeAppointmentId?: string
): Promise<{ unavailableDates: string[]; slotCounts: DateAvailabilityRow[]; summaryText: string }> {
  const dates = buildLookaheadDates();
  const slotCounts: DateAvailabilityRow[] = await Promise.all(
    dates.map(async (date) => {
      try {
        const raw = await fetchAvailableSlotsRaw(doctorId, date, excludeAppointmentId);
        return {
          date,
          dateLabel: toReadableDateLabel(date),
          slotCount: countFutureSlotsForToday(raw, date)
        };
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 403) {
          return { date, dateLabel: toReadableDateLabel(date), slotCount: 0 };
        }
        return { date, dateLabel: toReadableDateLabel(date), slotCount: 1 };
      }
    })
  );
  const unavailableDates = slotCounts.filter((row) => row.slotCount === 0).map((row) => row.date);
  return { unavailableDates, slotCounts, summaryText: buildSlotSummary(slotCounts) };
}

export async function fetchTimeSlotsForDate(
  doctorId: string,
  date: string,
  excludeAppointmentId?: string
): Promise<{
  slots: SelectOption[];
  message: string;
  forbidden: boolean;
}> {
  try {
    const raw = await fetchAvailableSlotsRaw(doctorId, date, excludeAppointmentId);
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const dataNode = envelope.Data ?? envelope.data ?? {};
    const list = keepOnlyFutureSlotsForToday(date, mapAvailableSlotsPayload(dataNode));
    const all = mapAvailableSlotsPayload(dataNode);
    let message = '';
    if (all.length === 0) {
      message = 'slotNoneForDate';
    } else if (list.length === 0) {
      message = 'slotNoneFutureToday';
    }
    return {
      slots: list.map((s) => ({ id: s.id, label: s.label, value: s.value })),
      message,
      forbidden: false
    };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      return { slots: [], message: 'slotsForbiddenDoctor', forbidden: true };
    }
    return { slots: [], message: 'slotsLoadFailed', forbidden: false };
  }
}

function appendAppointmentJsonPart(formData: FormData, payload: AppointmentCreatePayload): void {
  const json = JSON.stringify(payload);
  formData.append('appointment', {
    string: json,
    type: 'application/json',
    name: 'appointment.json'
  } as unknown as Blob);
}

function appendPrescriptionParts(formData: FormData, files: PickedPrescriptionImage[]): void {
  for (const file of files) {
    const name = file.name.trim() || `prescription-${Date.now()}.jpg`;
    formData.append('prescriptions', {
      uri: file.uri,
      name,
      type: normalizeUploadMimeType(name, file.mimeType)
    } as unknown as Blob);
  }
}

export async function createAppointment(
  form: AppointmentBookingForm,
  prescriptionFiles: PickedPrescriptionImage[]
): Promise<string> {
  const payload = buildAppointmentPayload(form);
  const formData = new FormData();
  appendAppointmentJsonPart(formData, payload);
  appendPrescriptionParts(formData, prescriptionFiles);

  const response = await apiClient.post(SERVER_PATHS.appointmentCreate, formData);
  if (!isEnvelopeSuccess(response.data)) {
    throw new Error('Appointment could not be created');
  }
  const dataNode = unwrapEnvelope<Record<string, unknown>>(response.data);
  return pickString(dataNode, ['Id', 'id']);
}

export async function updateAppointment(
  appointmentId: string,
  form: AppointmentBookingForm,
  prescriptionFiles: PickedPrescriptionImage[]
): Promise<void> {
  const payload = buildAppointmentPayload(form);
  const formData = new FormData();
  appendAppointmentJsonPart(formData, payload);
  appendPrescriptionParts(formData, prescriptionFiles);
  await apiClient.put(
    `${SERVER_PATHS.appointmentUpdate}/${encodeURIComponent(appointmentId)}`,
    formData
  );
}

export function getBookingErrorMessage(error: unknown): string {
  return toUserFacingApiError(error, 'Unable to save the appointment right now.');
}
