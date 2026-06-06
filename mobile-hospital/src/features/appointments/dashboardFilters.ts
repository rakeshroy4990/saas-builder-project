import type { SelectOption } from '@/features/appointments/bookingTypes';
import type { AppointmentSummary } from '@/features/appointments/types';

export const DASHBOARD_STATUS_ALL = '__ALL__';

export type DashboardFiltersState = {
  status: string;
  statusSelectedExplicitly: boolean;
  preferredDate: string;
  doctorId: string;
  department: string;
  adminFullListing: boolean;
};

export function createDefaultDashboardFilters(role: string): DashboardFiltersState {
  const normalizedRole = String(role ?? '').trim().toUpperCase();
  return {
    status: '',
    statusSelectedExplicitly: false,
    preferredDate: '',
    doctorId: '',
    department: '',
    adminFullListing: normalizedRole === 'ADMIN'
  };
}

export function buildStatusFilterOptions(role: string, t: (key: string) => string): SelectOption[] {
  const options: SelectOption[] = [
    { id: 'all', label: t('dashboard.filters.statusOptionAll'), value: DASHBOARD_STATUS_ALL },
    { id: 'completed', label: t('dashboard.filters.statusOptionCompleted'), value: 'COMPLETED' },
    { id: 'cancelled', label: t('dashboard.filters.statusOptionCancelled'), value: 'CANCELLED' }
  ];
  if (String(role ?? '').trim().toUpperCase() === 'ADMIN') {
    options.push({
      id: 'deleted',
      label: t('dashboard.filters.statusOptionRemovedAdmin'),
      value: 'DELETED'
    });
  }
  return options;
}

export function normalizeStatusFilterValue(raw: string): string {
  const value = String(raw ?? '').trim().toUpperCase();
  if (
    !value ||
    value === DASHBOARD_STATUS_ALL ||
    value === 'ALL' ||
    value === 'ALL APPOINTMENTS' ||
    value === 'ALL_APPOINTMENTS'
  ) {
    return DASHBOARD_STATUS_ALL;
  }
  return value;
}

function parseTimeToMinutes(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const twentyFour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const hh = Number(twentyFour[1]);
    const mm = Number(twentyFour[2]);
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      return hh * 60 + mm;
    }
  }

  const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!twelveHour) return null;
  let hh = Number(twelveHour[1]);
  const mm = Number(twelveHour[2]);
  const meridiem = String(twelveHour[3]).toUpperCase();
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
  if (meridiem === 'AM') {
    if (hh === 12) hh = 0;
  } else if (hh !== 12) {
    hh += 12;
  }
  return hh * 60 + mm;
}

function parseAppointmentStartMs(preferredDate: string, preferredTimeSlot: string): number | null {
  const date = String(preferredDate ?? '').trim();
  const slot = String(preferredTimeSlot ?? '').trim();
  if (!date || !slot) return null;
  const firstToken = slot.split(/\s*(?:-|–|—|\bto\b)\s*/i)[0]?.trim() ?? '';
  const minutes = parseTimeToMinutes(firstToken);
  if (minutes == null) return null;
  const day = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  day.setMinutes(minutes);
  return day.getTime();
}

export function sortAppointmentsByDateDesc(list: AppointmentSummary[]): AppointmentSummary[] {
  return [...list].sort((left, right) => {
    const leftTime = left.preferredDate ? new Date(left.preferredDate).getTime() : 0;
    const rightTime = right.preferredDate ? new Date(right.preferredDate).getTime() : 0;
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return right.preferredDate.localeCompare(left.preferredDate);
    }
    return rightTime - leftTime;
  });
}

export function filterDashboardAppointments(
  list: AppointmentSummary[],
  filters: DashboardFiltersState
): AppointmentSummary[] {
  const status = String(filters.status ?? '').trim().toUpperCase();
  const statusSelectedExplicitly = Boolean(filters.statusSelectedExplicitly);
  const preferredDate = String(filters.preferredDate ?? '').trim();
  const doctorId = String(filters.doctorId ?? '').trim();
  const department = String(filters.department ?? '').trim().toLowerCase();
  const statusFilterApplied = Boolean(status && status !== DASHBOARD_STATUS_ALL);
  const adminFullListing = Boolean(filters.adminFullListing);
  const defaultFilterState =
    !adminFullListing &&
    !statusSelectedExplicitly &&
    !statusFilterApplied &&
    !preferredDate &&
    !doctorId &&
    !department;
  const todayIso = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();

  return list.filter((row) => {
    const rowStatus = String(row.status ?? '').trim().toUpperCase();
    const rowDateRaw = String(row.preferredDate ?? '').trim();
    const rowDate = rowDateRaw.slice(0, 10);
    const rowDoctorId = String(row.doctorId ?? '').trim();
    const rowDepartment = String(row.department ?? '').trim().toLowerCase();

    if (defaultFilterState) {
      const rowStartMs = parseAppointmentStartMs(rowDateRaw, String(row.preferredTimeSlot ?? '').trim());
      if (rowStartMs != null && rowStartMs < nowMs) return false;
      if (rowStartMs == null && rowDate && rowDate < todayIso) return false;
    }
    if (statusFilterApplied && rowStatus !== status) return false;
    if (preferredDate && rowDate !== preferredDate) return false;
    if (doctorId && rowDoctorId !== doctorId) return false;
    if (department && rowDepartment !== department) return false;
    return true;
  });
}

export function mergeDoctorFilterOptions(
  existing: SelectOption[],
  appointments: AppointmentSummary[],
  allDoctorsLabel: string
): SelectOption[] {
  const doctorMap = new Map<string, SelectOption>();
  for (const option of existing) {
    const value = String(option.value ?? '').trim();
    if (!value) continue;
    doctorMap.set(value, option);
  }
  for (const row of appointments) {
    const value = String(row.doctorId ?? '').trim();
    const label = String(row.doctorName ?? value).trim();
    if (!value || !label || doctorMap.has(value)) continue;
    doctorMap.set(value, { id: value, value, label });
  }
  return [
    { id: 'all', label: allDoctorsLabel, value: '' },
    ...Array.from(doctorMap.values())
  ];
}

export function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim());
}
