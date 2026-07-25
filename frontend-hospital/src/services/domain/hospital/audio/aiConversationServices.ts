import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';

function isDoctorSession(): boolean {
  const auth = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  return String(auth.role ?? '').toUpperCase() === 'DOCTOR' && String(auth.userId ?? '').trim().length > 0;
}

async function loadDoctorAppointments(): Promise<void> {
  const appStore = useAppStore(pinia);
  const existing = (appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'AiConversationStart', {
    appointmentId: String(existing.appointmentId ?? ''),
    languageHint: String(existing.languageHint ?? 'mixed') || 'mixed',
    consent: Boolean(existing.consent),
    appointments: Array.isArray(existing.appointments) ? existing.appointments : [],
    error: '',
    loading: true
  });
  try {
    const { data } = await apiClient.get(URLRegistry.paths.appointmentGet, {
      params: { page: 0, size: 50, sort: 'createdTimestamp,desc' }
    });
    const envelope = (data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(envelope.Data) ? envelope.Data : [];
    const appointments = rows
      .map((row) => {
        const r = (row ?? {}) as Record<string, unknown>;
        const id = pickString(r, ['ExternalId', 'externalId', 'Id', 'id']);
        const name = pickString(r, ['PatientName', 'patientName']) || 'Patient';
        const date = pickString(r, ['PreferredDate', 'preferredDate']);
        const slot = pickString(r, ['PreferredTimeSlot', 'preferredTimeSlot']);
        const label = [name, date, slot].filter(Boolean).join(' · ');
        return { id, label, value: id };
      })
      .filter((a) => a.id);
    appStore.setProperty('hospital', 'AiConversationStart', 'appointments', appointments);
    appStore.setData('hospital', 'AiConversationAppointmentOptions', { list: appointments });
  } catch {
    appStore.setProperty('hospital', 'AiConversationStart', 'error', 'APPOINTMENTS_LOAD_FAILED');
  } finally {
    appStore.setProperty('hospital', 'AiConversationStart', 'loading', false);
  }
}

export const aiConversationHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-ai-conversation',
    responseCodes: { success: ['SUCCESS'], failure: ['AI_CONVERSATION_FORBIDDEN'] },
    execute: async () => {
      if (!isDoctorSession()) {
        return { responseCode: 'AI_CONVERSATION_FORBIDDEN', message: 'Doctor only' };
      }
      const appStore = useAppStore(pinia);
      const start = (appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'AiConversationStart', {
        appointmentId: String(start.appointmentId ?? ''),
        languageHint: 'mixed',
        consent: Boolean(start.consent),
        appointments: Array.isArray(start.appointments) ? start.appointments : [],
        error: '',
        loading: true
      });
      await loadDoctorAppointments();
      return ok();
    }
  }
];
