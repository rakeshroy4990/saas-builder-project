import { pickString, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';

import { fetchMedicalDepartments } from './bookingApi';
import type { SelectOption } from './bookingTypes';

const DOCTOR_LIST_ACTIVE_PATH = '/api/doctor/list-active';

export async function fetchDashboardDepartmentOptions(): Promise<SelectOption[]> {
  return fetchMedicalDepartments();
}

export async function fetchActiveDoctorFilterOptions(): Promise<SelectOption[]> {
  try {
    const response = await apiClient.get(DOCTOR_LIST_ACTIVE_PATH, { params: { page: 0, size: 500 } });
    const dataNode = unwrapEnvelope<unknown>(response.data);
    if (!Array.isArray(dataNode)) return [];
    return dataNode
      .map((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const id = pickString(row, ['Id', 'id']).trim() || `doctor-${index}`;
        const firstName = pickString(row, ['FirstName', 'firstName']);
        const lastName = pickString(row, ['LastName', 'lastName']);
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const name = pickString(row, ['Name', 'name']).trim() || fullName || id;
        return { id, value: id, label: name };
      })
      .filter((option) => option.label.trim().length > 0);
  } catch {
    return [];
  }
}
