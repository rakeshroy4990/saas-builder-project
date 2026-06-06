import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { i18n } from '../../../../i18n';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { MEDICAL_DEPARTMENT_CACHE_KEY } from './constants';
import { pickString } from './strings';

export type MedicalDepartmentOption = { id: string; label: string; value: string };

/** Active vue-i18n locale sent as {@code Accept-Language} on department GET. */
export function readActiveAppLocale(): string {
  const globalLocale = i18n.global.locale as unknown;
  const code =
    typeof globalLocale === 'string'
      ? globalLocale
      : (globalLocale as { value?: string })?.value ?? 'en';
  return acceptLanguageHeaderValue(code);
}

export function medicalDepartmentCacheStorageKey(locale: string): string {
  return `${MEDICAL_DEPARTMENT_CACHE_KEY}.${acceptLanguageHeaderValue(locale)}`;
}

export async function loadMedicalDepartmentOptions(): Promise<MedicalDepartmentOption[]> {
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

function readSessionDepartmentCache(locale: string): MedicalDepartmentOption[] | null {
  const raw = sessionStorage.getItem(medicalDepartmentCacheStorageKey(locale));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MedicalDepartmentOption[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Keeps appointment popup/chat dropdowns aligned with {@link MedicalDepartments}. */
export function syncAppointmentDepartmentsFromMedicalStore(): void {
  const appStore = useAppStore(pinia);
  const node = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
  const list = Array.isArray(node.list) ? (node.list as MedicalDepartmentOption[]) : [];
  appStore.setData('hospital', 'AppointmentDepartments', { list });
}

/** Refetch department labels for the active locale (e.g. after language switch). */
export async function reloadMedicalDepartmentOptionsForActiveLocale(): Promise<void> {
  await ensureMedicalDepartmentOptionsLoaded({ force: true });
  syncAppointmentDepartmentsFromMedicalStore();
}

export async function ensureMedicalDepartmentOptionsLoaded(options?: EnsureMedicalDepartmentOptions): Promise<void> {
  const force = Boolean(options?.force);
  const locale = readActiveAppLocale();
  const cacheKey = medicalDepartmentCacheStorageKey(locale);

  if (!force) {
    const existing = (useAppStore(pinia).getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
    const existingLocale = pickString(existing, ['locale']).toLowerCase();
    const existingList = Array.isArray(existing.list) ? (existing.list as unknown[]) : [];
    if (existingLocale === locale && existingList.length > 0) {
      return;
    }

    const cached = readSessionDepartmentCache(locale);
    if (cached) {
      useAppStore(pinia).setData('hospital', 'MedicalDepartments', { locale, list: cached });
      return;
    }
  } else {
    sessionStorage.removeItem(cacheKey);
  }

  const departmentOptions = await loadMedicalDepartmentOptions();
  useAppStore(pinia).setData('hospital', 'MedicalDepartments', { locale, list: departmentOptions });
  sessionStorage.setItem(cacheKey, JSON.stringify(departmentOptions));
}
