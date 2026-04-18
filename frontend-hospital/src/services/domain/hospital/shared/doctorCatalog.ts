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

export async function ensureDoctorOptionsLoadedByDepartment(
  department: string
): Promise<Array<{ id: string; label: string; value: string }>> {
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

  const fetchedOptions = await loadDoctorOptionsByDepartment(department);
  const merged = { ...byDepartment, [normalizedKey]: fetchedOptions };
  useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', { byDepartment: merged });
  sessionStorage.setItem(APPOINTMENT_DOCTOR_CACHE_KEY, JSON.stringify(merged));
  return fetchedOptions;
}
