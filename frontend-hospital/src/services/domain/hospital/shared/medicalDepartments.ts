import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { MEDICAL_DEPARTMENT_CACHE_KEY } from './constants';
import { pickString } from './strings';

export async function loadMedicalDepartmentOptions(): Promise<Array<{ id: string; label: string; value: string }>> {
  try {
    const response = await apiClient.get(URLRegistry.paths.medicalDepartmentGet, {
      params: { page: 0, size: 100 }
    });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = (envelope.Data ?? envelope.data ?? []) as unknown;
    if (!Array.isArray(dataNode)) {
      return [];
    }
    return dataNode
      .map((item, idx) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const id = pickString(record, ['Id', 'id']) || `dept-${idx}`;
        const name = pickString(record, ['Name', 'name']);
        const code = pickString(record, ['Code', 'code']);
        const label = [name, code ? `(${code})` : ''].filter(Boolean).join(' ').trim();
        return {
          id,
          label: label || id,
          value: code || name || id
        };
      })
      .filter((option) => option.label.trim().length > 0);
  } catch {
    return [];
  }
}

export async function ensureMedicalDepartmentOptionsLoaded(): Promise<void> {
  const existing = (useAppStore(pinia).getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
  const existingList = Array.isArray(existing.list) ? (existing.list as unknown[]) : [];
  if (existingList.length > 0) {
    return;
  }

  const cachedRaw = sessionStorage.getItem(MEDICAL_DEPARTMENT_CACHE_KEY);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as Array<{ id: string; label: string; value: string }>;
      if (Array.isArray(cached) && cached.length > 0) {
        useAppStore(pinia).setData('hospital', 'MedicalDepartments', { list: cached });
        return;
      }
    } catch {
      // Ignore invalid cache and fetch fresh values.
    }
  }

  const departmentOptions = await loadMedicalDepartmentOptions();
  useAppStore(pinia).setData('hospital', 'MedicalDepartments', { list: departmentOptions });
  sessionStorage.setItem(MEDICAL_DEPARTMENT_CACHE_KEY, JSON.stringify(departmentOptions));
}
