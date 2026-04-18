import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

function emptyWeekly(): Record<string, { enabled: boolean; slotMinutes: number; windows: { start: string; end: string }[] }> {
  const w: Record<string, { enabled: boolean; slotMinutes: number; windows: { start: string; end: string }[] }> = {};
  for (const k of DAY_KEYS) {
    w[k] = { enabled: k === 'MON', slotMinutes: 15, windows: [{ start: '09:00', end: '17:00' }] };
  }
  return w;
}

function mergeWeeklyFromApi(raw: unknown): Record<string, { enabled: boolean; slotMinutes: number; windows: { start: string; end: string }[] }> {
  const base = emptyWeekly();
  const node = (raw ?? {}) as Record<string, unknown>;
  const weekly = (node.Weekly ?? node.weekly ?? {}) as Record<string, unknown>;
  for (const k of DAY_KEYS) {
    const d = (weekly[k] ?? {}) as Record<string, unknown>;
    const enabled = Boolean(d.Enabled ?? d.enabled);
    const slotMinutesRaw = d.SlotMinutes ?? d.slotMinutes ?? 15;
    const slotMinutes = Number(slotMinutesRaw) === 30 ? 30 : 15;
    const winsRaw = (d.Windows ?? d.windows ?? []) as unknown[];
    const windows = Array.isArray(winsRaw)
      ? winsRaw.map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            start: pickString(o, ['Start', 'start']),
            end: pickString(o, ['End', 'end'])
          };
        })
      : [];
    base[k] = {
      enabled,
      slotMinutes,
      windows: windows.length > 0 ? windows : [{ start: '09:00', end: '17:00' }]
    };
  }
  return base;
}

export const doctorScheduleHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-doctor-working-slots',
    execute: async () => {
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'DashboardNav', { activeItem: 'working-slots' });
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(auth.role ?? '')
        .trim()
        .toUpperCase();
      const userId = pickString(auth, ['userId', 'UserId']).trim();
      appStore.setData('hospital', 'DoctorScheduleUi', { loading: true, error: '', selectedDoctorId: '', doctorName: '' });
      appStore.setData('hospital', 'DoctorScheduleForm', { weekly: emptyWeekly() });
      if (!userId) {
        appStore.setData('hospital', 'DoctorScheduleUi', { loading: false, error: 'Please sign in.', selectedDoctorId: '', doctorName: '' });
        return ok();
      }
      if (role === 'DOCTOR') {
        appStore.setProperty('hospital', 'DoctorScheduleUi', 'selectedDoctorId', userId);
        const dn = pickString(auth, ['userDisplayName', 'fullName', 'FullName']).trim();
        appStore.setProperty(
          'hospital',
          'DoctorScheduleUi',
          'doctorName',
          dn ? `Your schedule — ${dn}` : 'Your schedule'
        );
      } else if (role === 'ADMIN') {
        try {
          const response = await apiClient.get(URLRegistry.paths.doctorListActive, { params: { page: 0, size: 500 } });
          const envelope = (response.data ?? {}) as Record<string, unknown>;
          const raw = envelope.Data ?? envelope.data ?? [];
          const list = Array.isArray(raw) ? (raw as unknown[]) : [];
          const options = list.map((row, idx) => {
            const o = (row ?? {}) as Record<string, unknown>;
            const id = pickString(o, ['Id', 'id']).trim() || `doc-${idx}`;
            const name = pickString(o, ['Name', 'name']).trim() || id;
            return { id, label: name, value: id };
          });
          appStore.setData('hospital', 'DoctorScheduleAdminDoctors', { list: options });
          const firstId = options[0]?.value ? String(options[0].value) : '';
          appStore.setProperty('hospital', 'DoctorScheduleUi', 'selectedDoctorId', firstId);
          if (firstId) {
            const match = options.find((x: { value: string }) => x.value === firstId);
            appStore.setProperty('hospital', 'DoctorScheduleUi', 'doctorName', match?.label ?? '');
          }
        } catch {
          appStore.setData('hospital', 'DoctorScheduleAdminDoctors', { list: [] });
          appStore.setProperty('hospital', 'DoctorScheduleUi', 'error', 'Unable to load doctors.');
        }
      } else {
        appStore.setData('hospital', 'DoctorScheduleUi', { loading: false, error: 'Only Admin or Doctor can edit schedules.', selectedDoctorId: '', doctorName: '' });
        return ok();
      }
      const selected = pickString(
        (appStore.getData('hospital', 'DoctorScheduleUi') ?? {}) as Record<string, unknown>,
        ['selectedDoctorId']
      ).trim();
      if (selected) {
        try {
          const response = await apiClient.get(URLRegistry.paths.doctorSchedule, { params: { doctorId: selected } });
          const envelope = (response.data ?? {}) as Record<string, unknown>;
          const dataNode = (envelope.Data ?? envelope.data ?? null) as Record<string, unknown> | null;
          if (dataNode && typeof dataNode === 'object') {
            appStore.setData('hospital', 'DoctorScheduleForm', { weekly: mergeWeeklyFromApi(dataNode) });
            const dn = pickString(dataNode, ['DoctorId', 'doctorId']);
            if (dn) {
              appStore.setProperty('hospital', 'DoctorScheduleUi', 'selectedDoctorId', dn);
            }
          } else {
            appStore.setData('hospital', 'DoctorScheduleForm', { weekly: emptyWeekly() });
          }
        } catch {
          appStore.setData('hospital', 'DoctorScheduleForm', { weekly: emptyWeekly() });
          appStore.setProperty('hospital', 'DoctorScheduleUi', 'error', 'Unable to load schedule (using defaults).');
        }
      }
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'loading', false);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-working-slots-doctor',
    execute: async (request) => {
      const id = String(request.data.value ?? '').trim();
      const appStore = useAppStore(pinia);
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'selectedDoctorId', id);
      const opts = (appStore.getData('hospital', 'DoctorScheduleAdminDoctors') ?? {}) as { list?: { value: string; label: string }[] };
      const match = (opts.list ?? []).find((x) => x.value === id);
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'doctorName', match?.label ?? '');
      if (!id) return ok();
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'loading', true);
      try {
        const response = await apiClient.get(URLRegistry.paths.doctorSchedule, { params: { doctorId: id } });
        const envelope = (response.data ?? {}) as Record<string, unknown>;
        const dataNode = (envelope.Data ?? envelope.data ?? null) as Record<string, unknown> | null;
        if (dataNode && typeof dataNode === 'object') {
          appStore.setData('hospital', 'DoctorScheduleForm', { weekly: mergeWeeklyFromApi(dataNode) });
        } else {
          appStore.setData('hospital', 'DoctorScheduleForm', { weekly: emptyWeekly() });
        }
      } catch {
        appStore.setData('hospital', 'DoctorScheduleForm', { weekly: emptyWeekly() });
      }
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'loading', false);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'load-doctor-schedule',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const ui = (appStore.getData('hospital', 'DoctorScheduleUi') ?? {}) as Record<string, unknown>;
      const selected = pickString(ui, ['selectedDoctorId']).trim();
      if (!selected) return ok();
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'loading', true);
      try {
        const response = await apiClient.get(URLRegistry.paths.doctorSchedule, { params: { doctorId: selected } });
        const envelope = (response.data ?? {}) as Record<string, unknown>;
        const dataNode = (envelope.Data ?? envelope.data ?? null) as Record<string, unknown> | null;
        if (dataNode && typeof dataNode === 'object') {
          appStore.setData('hospital', 'DoctorScheduleForm', { weekly: mergeWeeklyFromApi(dataNode) });
        } else {
          appStore.setData('hospital', 'DoctorScheduleForm', { weekly: emptyWeekly() });
        }
      } catch {
        appStore.setProperty('hospital', 'DoctorScheduleUi', 'error', 'Unable to load schedule.');
      }
      appStore.setProperty('hospital', 'DoctorScheduleUi', 'loading', false);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'save-doctor-schedule',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const ui = (appStore.getData('hospital', 'DoctorScheduleUi') ?? {}) as Record<string, unknown>;
      const doctorId = pickString(ui, ['selectedDoctorId']).trim();
      if (!doctorId) {
        useToastStore(pinia).show('Select a doctor first.', 'error');
        return ok();
      }
      const form = (appStore.getData('hospital', 'DoctorScheduleForm') ?? {}) as Record<string, unknown>;
      const weekly = form.weekly as Record<string, { enabled: boolean; slotMinutes: number; windows: { start: string; end: string }[] }>;
      const Weekly: Record<string, unknown> = {};
      for (const k of DAY_KEYS) {
        const d = weekly?.[k] ?? { enabled: false, slotMinutes: 15, windows: [] };
        Weekly[k] = {
          Enabled: Boolean(d.enabled),
          SlotMinutes: d.slotMinutes === 30 ? 30 : 15,
          Windows: (d.windows ?? []).map((w) => ({ Start: w.start, End: w.end }))
        };
      }
      try {
        await apiClient.put(URLRegistry.paths.doctorSchedule, { DoctorId: doctorId, Weekly });
        useToastStore(pinia).show('Working schedule saved.', 'success');
      } catch (error) {
        const msg = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to save schedule.'
          : 'Unable to save schedule.';
        useToastStore(pinia).show(msg, 'error');
      }
      return ok();
    }
  }
];
