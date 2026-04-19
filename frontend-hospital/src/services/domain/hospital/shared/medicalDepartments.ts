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
        const activeRaw = record.Active ?? record.active;
        const active = activeRaw === undefined || activeRaw === true || activeRaw === 'true';
        // Single-line label for native <select>: name + code only. Do not append Description here —
        // it often repeats the name (e.g. US/UK spelling) and forces the control very wide.
        const label = [name, code ? `(${code})` : ''].filter(Boolean).join(' ').trim();
        return {
          id,
          label: label || id,
          value: code || name || id,
          active
        };
      })
      .filter((option) => option.active !== false && String(option.label).trim().length > 0);
  } catch {
    return [];
  }
}

export type EnsureMedicalDepartmentOptions = {
  /**
   * When true, always calls GET /api/medical-department/get and overwrites Pinia + sessionStorage.
   * Use when opening Register (or similar) so name/description edits in DB are visible.
   */
  force?: boolean;
};

export async function ensureMedicalDepartmentOptionsLoaded(options?: EnsureMedicalDepartmentOptions): Promise<void> {
  const force = Boolean(options?.force);

  if (!force) {
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
  } else {
    sessionStorage.removeItem(MEDICAL_DEPARTMENT_CACHE_KEY);
  }

  const departmentOptions = await loadMedicalDepartmentOptions();
  useAppStore(pinia).setData('hospital', 'MedicalDepartments', { list: departmentOptions });
  sessionStorage.setItem(MEDICAL_DEPARTMENT_CACHE_KEY, JSON.stringify(departmentOptions));
}
