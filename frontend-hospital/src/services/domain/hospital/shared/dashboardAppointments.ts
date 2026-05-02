import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { pickString } from './strings';

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
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  day.setMinutes(minutes);
  return day.getTime();
}

function formatMinutesToTwelveHour(totalMinutes: number): string {
  const safe = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hh24 = Math.floor(safe / 60);
  const mm = safe % 60;
  const meridiem = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${meridiem}`;
}

function formatSlotTimeToken(raw: string): string {
  const minutes = parseTimeToMinutes(raw);
  if (minutes == null) return String(raw ?? '').trim();
  return formatMinutesToTwelveHour(minutes);
}

function formatPreferredTimeSlot(raw: string): string {
  const slot = String(raw ?? '').trim();
  if (!slot) return '';
  const parts = slot.split(/\s*(?:-|–|—|\bto\b)\s*/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return slot;
  if (parts.length === 1) return formatSlotTimeToken(parts[0]);
  return `${formatSlotTimeToken(parts[0])} - ${formatSlotTimeToken(parts[1])}`;
}

function resolveAppointmentRowPayload(entry: unknown): Record<string, unknown> {
  const row = (entry ?? {}) as Record<string, unknown>;
  const nested = (row.Data ?? row.data ?? row.Item ?? row.item) as unknown;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return row;
}

/** Prefer computing here instead of a long `condition` on list rows (avoids fragile `new Function` param lists). */
export function computeCanEditAppointment(row: Record<string, unknown>): 'Y' | '' {
  const createdByRaw = pickString(row, ['CreatedBy', 'createdBy']).trim();
  const statusRaw = pickString(row, ['Status', 'status']).trim().toUpperCase();
  if (statusRaw === 'CANCELLED') {
    return '';
  }
  const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const myId = String(authSession.userId ?? '').trim();
  if (!myId) {
    return '';
  }
  if (createdByRaw && myId.toLowerCase() === createdByRaw.toLowerCase()) {
    return 'Y';
  }
  const myEmail = String(authSession.email ?? '').trim().toLowerCase();
  const rowEmail = pickString(row, ['Email', 'email']).trim().toLowerCase();
  if (!createdByRaw && myEmail && rowEmail && myEmail === rowEmail) {
    return 'Y';
  }
  return '';
}

export function normalizeAppointmentRecord(entry: unknown, idx: number): Record<string, unknown> {
  const row = resolveAppointmentRowPayload(entry);
  const id = pickString(row, ['Id', 'id']) || `appointment-${idx}`;
  const preferredDate = pickString(row, ['PreferredDate', 'preferredDate']);
  const createdTimestamp = pickString(row, ['CreatedTimestamp', 'createdTimestamp']);
  const canEditAppointment = computeCanEditAppointment(row);
  const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const role = String(authSession.role ?? '').trim().toUpperCase();
  const myUserId = String(authSession.userId ?? '').trim();
  const doctorRowId = pickString(row, ['DoctorId', 'doctorId']).trim();
  const isAssignedDoctor =
    role === 'DOCTOR' && Boolean(myUserId && doctorRowId && doctorRowId.toLowerCase() === myUserId.toLowerCase());
  const statusU = pickString(row, ['Status', 'status']).trim().toUpperCase();
  const canMarkVisitComplete = isAssignedDoctor && statusU !== 'CANCELLED' && statusU !== 'COMPLETED';
  const canIssueEprescription = isAssignedDoctor && statusU === 'COMPLETED';
  const canDownloadEprescription =
    statusU === 'COMPLETED' && (canEditAppointment === 'Y' || isAssignedDoctor || role === 'ADMIN');
  const preferredTimeSlot = pickString(row, ['PreferredTimeSlot', 'preferredTimeSlot']);
  const appointmentStartMs = parseAppointmentStartMs(preferredDate, preferredTimeSlot);
  const createdByNorm = pickString(row, ['CreatedBy', 'createdBy']).trim();
  const baseCanStartVideoCall =
    statusU !== 'CANCELLED'
    && statusU !== 'COMPLETED'
    && statusU !== 'DELETED'
    && appointmentStartMs != null
    && Date.now() >= appointmentStartMs - 15 * 60 * 1000;
  const adminCreatedThisAppointment =
    role === 'ADMIN' &&
    Boolean(myUserId && createdByNorm && createdByNorm.toLowerCase() === myUserId.toLowerCase());
  const canStartVideoCall =
    role === 'ADMIN' ? baseCanStartVideoCall && adminCreatedThisAppointment : baseCanStartVideoCall;
  return {
    id,
    patientName: pickString(row, ['PatientName', 'patientName']) || 'Patient',
    email: pickString(row, ['Email', 'email']),
    phoneNumber: pickString(row, ['PhoneNumber', 'phoneNumber']),
    ageGroup: pickString(row, ['AgeGroup', 'ageGroup']),
    department: pickString(row, ['Department', 'department']),
    doctorId: pickString(row, ['DoctorId', 'doctorId']),
    doctorName:
      pickString(row, ['DoctorName', 'doctorName', 'AssignedDoctorName', 'assignedDoctorName']) || 'Doctor',
    preferredDate,
    preferredTimeSlot: formatPreferredTimeSlot(preferredTimeSlot),
    status: pickString(row, ['Status', 'status']) || 'SCHEDULED',
    additionalNotes: pickString(row, ['AdditionalNotes', 'additionalNotes']),
    createdTimestamp,
    createdBy: createdByNorm,
    sortTimestamp: preferredDate || createdTimestamp || '',
    statusLabel: pickString(row, ['Status', 'status']) || 'Scheduled',
    hasReceipt:
      Array.isArray(row.PrescriptionFiles) && (row.PrescriptionFiles as unknown[]).length > 0
        ? 'Y'
        : Array.isArray(row.prescriptionFiles) && (row.prescriptionFiles as unknown[]).length > 0
          ? 'Y'
          : '',
    receiptActionIcon:
      (Array.isArray(row.PrescriptionFiles) && (row.PrescriptionFiles as unknown[]).length > 0) ||
      (Array.isArray(row.prescriptionFiles) && (row.prescriptionFiles as unknown[]).length > 0)
        ? '🧾'
        : '',
    firstReceiptFileId: (() => {
      const list = Array.isArray(row.PrescriptionFiles)
        ? (row.PrescriptionFiles as unknown[])
        : Array.isArray(row.prescriptionFiles)
          ? (row.prescriptionFiles as unknown[])
          : [];
      const first = (list[0] ?? {}) as Record<string, unknown>;
      return pickString(first, ['FileId', 'fileId', 'Id', 'id']);
    })(),
    canEditAppointment,
    isAssignedDoctor: isAssignedDoctor ? 'Y' : '',
    canMarkVisitComplete: canMarkVisitComplete ? 'Y' : '',
    canIssueEprescription: canIssueEprescription ? 'Y' : '',
    canDownloadEprescription: canDownloadEprescription ? 'Y' : '',
    canStartVideoCall: canStartVideoCall ? 'Y' : ''
  };
}

export function sortAppointmentsByDateDesc(list: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...list].sort((a, b) => {
    const left = String(a.sortTimestamp ?? '');
    const right = String(b.sortTimestamp ?? '');
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return right.localeCompare(left);
    return rightTime - leftTime;
  });
}

export function filterDashboardAppointments(
  list: Array<Record<string, unknown>>,
  filters: Record<string, unknown>
): Array<Record<string, unknown>> {
  const status = String(filters.status ?? '').trim().toUpperCase();
  const statusSelectedExplicitly = Boolean(filters.statusSelectedExplicitly);
  const preferredDate = String(filters.preferredDate ?? '').trim();
  const doctorId = String(filters.doctorId ?? '').trim();
  const department = String(filters.department ?? '').trim().toLowerCase();
  const statusFilterApplied = Boolean(status && status !== '__ALL__');
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

export async function loadDashboardAppointmentsPage(requestedPage?: number): Promise<void> {
  const appStore = useAppStore(pinia);
  const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const userRole = String(authSession.role ?? '').trim().toUpperCase();
  const current = (appStore.getData('hospital', 'DashboardAppointments') ?? {}) as Record<string, unknown>;
  const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
  const page = requestedPage == null ? Number(current.page ?? 0) : Math.max(0, Number(requestedPage));
  const size = 10;
  appStore.setData('hospital', 'DashboardAppointments', {
    ...current,
    loading: true,
    error: '',
    page,
    size,
    pageLabel: `Page ${page + 1}`,
    totalLabel: `Total Appointments: ${Number(current.totalElements ?? 0)}`
  });
  try {
    const listUrl =
      userRole === 'ADMIN' ? URLRegistry.paths.adminAppointments : URLRegistry.paths.appointmentGet;
    const response = await apiClient.get(listUrl, { params: { page, size } });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = (envelope.Data ?? envelope.data ?? []) as unknown;
    const rows = Array.isArray(dataNode)
      ? dataNode
      : Array.isArray((dataNode as Record<string, unknown>)?.content)
        ? (((dataNode as Record<string, unknown>).content as unknown[]) ?? [])
        : [];
    const normalized = sortAppointmentsByDateDesc(rows.map((entry, idx) => normalizeAppointmentRecord(entry, idx)));
    const filtered = filterDashboardAppointments(normalized, filters);
    const doctorFromAppointments = normalized
      .map((row) => {
        const value = String(row.doctorId ?? '').trim();
        const label = String(row.doctorName ?? value).trim();
        if (!value || !label) return null;
        return { id: value, value, label };
      })
      .filter((entry): entry is { id: string; value: string; label: string } => entry !== null);
    const doctorMap = new Map<string, { id: string; value: string; label: string }>();
    for (const option of doctorFromAppointments) {
      if (!doctorMap.has(option.value)) doctorMap.set(option.value, option);
    }
    const existingFilters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
    const existingDoctorOptions = Array.isArray(existingFilters.doctorOptions)
      ? (existingFilters.doctorOptions as Array<{ id?: string; value?: string; label?: string }>)
      : [];
    const mergedDoctorOptions = [
      { id: 'all', value: '', label: 'All Doctors' },
      ...existingDoctorOptions
        .filter((option) => String(option.value ?? '').trim())
        .map((option) => ({
          id: String(option.id ?? option.value ?? '').trim(),
          value: String(option.value ?? '').trim(),
          label: String(option.label ?? option.value ?? '').trim()
        })),
      ...doctorMap.values()
    ].filter((option, index, arr) => {
      if (!option.value) return index === 0;
      return arr.findIndex((x) => x.value === option.value) === index;
    });
    appStore.setData('hospital', 'DashboardFilters', {
      ...existingFilters,
      doctorOptions: mergedDoctorOptions
    });
    const totalElementsRaw = Number(
      (dataNode as Record<string, unknown>)?.totalElements ??
        (dataNode as Record<string, unknown>)?.TotalElements ??
        (dataNode as Record<string, unknown>)?.total ??
        filtered.length
    );
    const totalElements = Number.isFinite(totalElementsRaw) ? Math.max(0, totalElementsRaw) : filtered.length;
    const totalPagesRaw = Number(
      (dataNode as Record<string, unknown>)?.totalPages ?? Math.max(1, Math.ceil(totalElements / size))
    );
    const totalPages = Number.isFinite(totalPagesRaw) ? Math.max(1, totalPagesRaw) : 1;
    const hasNext = page + 1 < totalPages || filtered.length === size;
    appStore.setData('hospital', 'DashboardAppointments', {
      ...current,
      loading: false,
      error: '',
      page,
      size,
      list: filtered,
      totalPages,
      totalElements,
      hasNext,
      pageLabel: `Page ${page + 1} of ${totalPages}`,
      totalLabel: `Total Appointments: ${totalElements}`
    });
  } catch (error) {
    const message = isAxiosError(error)
      ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
        'Unable to load appointments right now.'
      : 'Unable to load appointments right now.';
    appStore.setData('hospital', 'DashboardAppointments', {
      ...current,
      loading: false,
      list: [],
      error: message,
      page,
      size,
      totalPages: 1,
      totalElements: 0,
      hasNext: false,
      pageLabel: 'Page 1 of 1',
      totalLabel: 'Total Appointments: 0'
    });
  }
}
