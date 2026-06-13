import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import {
  listChildProfilesForPatient,
  saveGrowthRecord,
  type ChildProfileRow
} from '../../../http/growthApi';
import { pickString } from '../shared/strings';
import { ok } from '../shared/response';

export interface AppointmentGrowthSessionState {
  loading: boolean;
  appointmentId: string;
  appointmentExternalId: string;
  patientUserId: string;
  patientName: string;
  children: ChildProfileRow[];
  selectedChildId: string;
  entryHeightCm: string;
  entryWeightKg: string;
  entryHcCm: string;
  lastSavedSummary: string;
}

function defaultSession(): AppointmentGrowthSessionState {
  return {
    loading: false,
    appointmentId: '',
    appointmentExternalId: '',
    patientUserId: '',
    patientName: '',
    children: [],
    selectedChildId: '',
    entryHeightCm: '',
    entryWeightKg: '',
    entryHcCm: '',
    lastSavedSummary: ''
  };
}

function growthStore() {
  return useAppStore(pinia);
}

function session(): AppointmentGrowthSessionState {
  const raw = (growthStore().getData('hospital', 'AppointmentGrowthSession') ?? {}) as Partial<AppointmentGrowthSessionState>;
  return { ...defaultSession(), ...raw };
}

function setSession(patch: Partial<AppointmentGrowthSessionState>): void {
  growthStore().setData('hospital', 'AppointmentGrowthSession', { ...session(), ...patch });
}

async function resolveAppointmentExternalId(appointmentId: string): Promise<string> {
  const existing = session().appointmentExternalId;
  if (existing) return existing;
  const response = await apiClient.get(`${URLRegistry.paths.appointmentGet}/${encodeURIComponent(appointmentId)}`);
  const row = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
  return pickString(row, ['ExternalId', 'externalId']);
}

async function hydrateAppointmentGrowthPopup(): Promise<unknown> {
  const s = session();
  const appointmentId = s.appointmentId.trim();
  const patientUserId = s.patientUserId.trim();
  if (!appointmentId || !patientUserId) {
    useToastStore(pinia).show('Missing appointment context.', 'error');
    return { responseCode: 'APPOINTMENT_GROWTH_HYDRATE_FAILED', message: 'Missing appointment context' };
  }
  setSession({ loading: true, lastSavedSummary: '' });
  try {
    const appointmentExternalId = await resolveAppointmentExternalId(appointmentId);
    const children = await listChildProfilesForPatient(patientUserId);
    const selectedChildId = s.selectedChildId || children[0]?.externalId || '';
    setSession({
      appointmentExternalId,
      children,
      selectedChildId,
      loading: false
    });
    return ok('growth.appointment.loaded');
  } catch (err) {
    setSession({ loading: false });
    const message = pickString((err as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {}, ['Message']);
    useToastStore(pinia).show(message || 'Failed to load child profiles', 'error');
    throw err;
  }
}

async function saveAppointmentGrowthReading(): Promise<unknown> {
  const s = session();
  if (!s.selectedChildId) {
    useToastStore(pinia).show('Select a child first', 'error');
    return ok('growth.appointment.no_child');
  }
  if (!s.appointmentExternalId) {
    useToastStore(pinia).show('Appointment link is missing', 'error');
    return ok('growth.appointment.no_appointment');
  }
  const weightKg = s.entryWeightKg.trim() ? Number(s.entryWeightKg) : null;
  const heightCm = s.entryHeightCm.trim() ? Number(s.entryHeightCm) : null;
  const headCircumferenceCm = s.entryHcCm.trim() ? Number(s.entryHcCm) : null;
  if (weightKg == null && heightCm == null && headCircumferenceCm == null) {
    useToastStore(pinia).show('Enter at least one measurement', 'error');
    return ok('growth.appointment.entry.invalid');
  }
  setSession({ loading: true });
  try {
    const saved = await saveGrowthRecord({
      childProfileExternalId: s.selectedChildId,
      weightKg,
      heightCm,
      headCircumferenceCm,
      source: 'clinic',
      appointmentExternalId: s.appointmentExternalId
    });
    const parts: string[] = [];
    if (saved.weightPercentile != null) parts.push(`Weight P${Math.round(saved.weightPercentile)}`);
    if (saved.heightPercentile != null) parts.push(`Height P${Math.round(saved.heightPercentile)}`);
    if (saved.bmiPercentile != null && saved.bmiPercentile >= 40) {
      parts.push(`BMI P${Math.round(saved.bmiPercentile)}`);
    }
    if (saved.hcPercentile != null) parts.push(`HC P${Math.round(saved.hcPercentile)}`);
    setSession({
      entryHeightCm: '',
      entryWeightKg: '',
      entryHcCm: '',
      loading: false,
      lastSavedSummary: parts.length ? parts.join(' · ') : 'Saved'
    });
    useToastStore(pinia).show('Growth reading saved for visit', 'success');
    return ok('growth.appointment.record.saved');
  } catch (err) {
    setSession({ loading: false });
    const message = pickString((err as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {}, ['Message']);
    useToastStore(pinia).show(message || 'Failed to save reading', 'error');
    throw err;
  }
}

async function patchAppointmentGrowthSession(data: Record<string, unknown>): Promise<unknown> {
  const patch: Partial<AppointmentGrowthSessionState> = {};
  for (const key of ['entryHeightCm', 'entryWeightKg', 'entryHcCm'] as const) {
    if (data[key] != null) {
      patch[key] = String(data[key]);
    }
  }
  if (data.childId != null) {
    patch.selectedChildId = String(data.childId).trim();
  }
  setSession(patch);
  return ok('growth.appointment.session.patched');
}

export const appointmentGrowthHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-appointment-growth-popup',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      const appointmentExternalId = String(request.data?.appointmentExternalId ?? '').trim();
      const patientUserId = String(request.data?.patientUserId ?? request.data?.createdBy ?? '').trim();
      const patientName = String(request.data?.patientName ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'APPOINTMENT_GROWTH_OPEN_FAILED', message: 'Missing appointment id' };
      }
      if (!patientUserId) {
        useToastStore(pinia).show('Patient account is not linked to this appointment.', 'error');
        return { responseCode: 'APPOINTMENT_GROWTH_OPEN_FAILED', message: 'Missing patient user id' };
      }
      growthStore().setData('hospital', 'AppointmentGrowthSession', {
        ...defaultSession(),
        appointmentId,
        appointmentExternalId,
        patientUserId,
        patientName
      });
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'appointment-growth-popup',
        title: 'growth.appointment.title',
        initKey: `growth-${appointmentId}-${Date.now()}`
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'hydrate-appointment-growth-popup',
    execute: async () => hydrateAppointmentGrowthPopup()
  },
  {
    packageName: 'hospital',
    serviceId: 'save-appointment-growth-reading',
    execute: async () => saveAppointmentGrowthReading()
  },
  {
    packageName: 'hospital',
    serviceId: 'patch-appointment-growth-session',
    execute: async ({ data }) => patchAppointmentGrowthSession(data ?? {})
  }
];
