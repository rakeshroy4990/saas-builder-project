import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { APPOINTMENT_DOCTOR_CACHE_KEY } from './constants';
import { pickString } from './strings';

export function normalizeDepartmentKey(department: string): string {
  return String(department ?? '').trim().toLowerCase();
}

export async function loadDoctorOptionsByDepartment(
  department: string
): Promise<Array<{ id: string; label: string; value: string }>> {
  try {
    const response = await apiClient.get(URLRegistry.paths.doctorGet, {
      params: { department, page: 0, size: 100 }
    });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = (envelope.Data ?? envelope.data ?? []) as unknown;
    if (!Array.isArray(dataNode)) {
      return [];
    }
    return dataNode
      .map((item, idx) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const id = pickString(record, ['Id', 'id']) || `doctor-${idx}`;
        const firstName = pickString(record, ['FirstName', 'firstName']);
        const lastName = pickString(record, ['LastName', 'lastName']);
        const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const name = pickString(record, ['Name', 'name']) || combinedName;
        const email = pickString(record, ['Email', 'email']);
        const label = [name, email ? `(${email})` : ''].filter(Boolean).join(' ').trim();
        return { id, label: label || id, value: id };
      })
      .filter((option) => option.label.trim().length > 0);
  } catch {
    throw new Error('Unable to load doctor options');
  }
}

export type EnsureDoctorOptionsByDepartmentOptions = {
  /**
   * When true, skips Pinia/sessionStorage hits and refetches so new doctors or DB fixes appear
   * after a department is (re)selected.
   */
  force?: boolean;
};

function removeAppointmentDoctorCacheEntry(normalizedKey: string): void {
  const appStore = useAppStore(pinia);
  const existingCatalog = (appStore.getData('hospital', 'AppointmentDoctorCatalog') ?? {}) as Record<
    string,
    unknown
  >;
  const byDepartment = { ...((existingCatalog.byDepartment as Record<string, unknown>) ?? {}) };
  delete byDepartment[normalizedKey];
  appStore.setData('hospital', 'AppointmentDoctorCatalog', { byDepartment });

  const cachedRaw = sessionStorage.getItem(APPOINTMENT_DOCTOR_CACHE_KEY);
  if (!cachedRaw) {
    return;
  }
  try {
    const cachedCatalog = JSON.parse(cachedRaw) as Record<string, unknown>;
    if (cachedCatalog[normalizedKey] !== undefined) {
      delete cachedCatalog[normalizedKey];
      sessionStorage.setItem(APPOINTMENT_DOCTOR_CACHE_KEY, JSON.stringify(cachedCatalog));
    }
  } catch {
    sessionStorage.removeItem(APPOINTMENT_DOCTOR_CACHE_KEY);
  }
}

export async function ensureDoctorOptionsLoadedByDepartment(
  department: string,
  options?: EnsureDoctorOptionsByDepartmentOptions
): Promise<Array<{ id: string; label: string; value: string }>> {
  const force = Boolean(options?.force);
  const normalizedKey = normalizeDepartmentKey(department);
  if (!normalizedKey) {
    return [];
  }
  const existingCatalog = (useAppStore(pinia).getData('hospital', 'AppointmentDoctorCatalog') ?? {}) as Record<
    string,
    unknown
  >;
  const byDepartment = ((existingCatalog.byDepartment as Record<string, unknown>) ?? {}) as Record<
    string,
    unknown
  >;

  if (force) {
    removeAppointmentDoctorCacheEntry(normalizedKey);
  } else {
    const existingOptions = byDepartment[normalizedKey];
    if (Array.isArray(existingOptions) && existingOptions.length > 0) {
      return existingOptions as Array<{ id: string; label: string; value: string }>;
    }

    const cachedRaw = sessionStorage.getItem(APPOINTMENT_DOCTOR_CACHE_KEY);
    if (cachedRaw) {
      try {
        const cachedCatalog = JSON.parse(cachedRaw) as Record<
          string,
          Array<{ id: string; label: string; value: string }>
        >;
        const cachedOptions = cachedCatalog[normalizedKey];
        if (Array.isArray(cachedOptions) && cachedOptions.length > 0) {
          useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', {
            byDepartment: { ...byDepartment, [normalizedKey]: cachedOptions }
          });
          return cachedOptions;
        }
      } catch {
        // Ignore cache parse errors and fetch fresh values.
      }
    }
  }

  const refreshedByDepartment = (
    (useAppStore(pinia).getData('hospital', 'AppointmentDoctorCatalog') ?? {}) as Record<string, unknown>
  ).byDepartment as Record<string, unknown> | undefined;
  const byDeptAfter = { ...(refreshedByDepartment ?? {}) };

  const fetchedOptions = await loadDoctorOptionsByDepartment(department);
  const merged = { ...byDeptAfter, [normalizedKey]: fetchedOptions };
  useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', { byDepartment: merged });
  sessionStorage.setItem(APPOINTMENT_DOCTOR_CACHE_KEY, JSON.stringify(merged));
  return fetchedOptions;
}
