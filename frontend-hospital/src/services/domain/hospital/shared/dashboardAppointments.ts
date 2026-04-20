import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { pickString } from './strings';

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
    preferredTimeSlot: pickString(row, ['PreferredTimeSlot', 'preferredTimeSlot']),
    status: pickString(row, ['Status', 'status']) || 'SCHEDULED',
    additionalNotes: pickString(row, ['AdditionalNotes', 'additionalNotes']),
    createdTimestamp,
    createdBy: pickString(row, ['CreatedBy', 'createdBy']),
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
    canDownloadEprescription: canDownloadEprescription ? 'Y' : ''
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
  const preferredDate = String(filters.preferredDate ?? '').trim();
  const doctorId = String(filters.doctorId ?? '').trim();
  const department = String(filters.department ?? '').trim().toLowerCase();
  return list.filter((row) => {
    const rowStatus = String(row.status ?? '').trim().toUpperCase();
    const rowDate = String(row.preferredDate ?? '').trim();
    const rowDoctorId = String(row.doctorId ?? '').trim();
    const rowDepartment = String(row.department ?? '').trim().toLowerCase();
    if (status && rowStatus !== status) return false;
    if (preferredDate && rowDate !== preferredDate) return false;
    if (doctorId && rowDoctorId !== doctorId) return false;
    if (department && rowDepartment !== department) return false;
    return true;
  });
}

export async function loadDashboardAppointmentsPage(requestedPage?: number): Promise<void> {
  const appStore = useAppStore(pinia);
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
    const response = await apiClient.get(URLRegistry.paths.appointmentGet, { params: { page, size } });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = (envelope.Data ?? envelope.data ?? []) as unknown;
    const rows = Array.isArray(dataNode)
      ? dataNode
      : Array.isArray((dataNode as Record<string, unknown>)?.content)
        ? (((dataNode as Record<string, unknown>).content as unknown[]) ?? [])
        : [];
    const normalized = sortAppointmentsByDateDesc(rows.map((entry, idx) => normalizeAppointmentRecord(entry, idx)));
    const filtered = filterDashboardAppointments(normalized, filters);
    const totalElementsRaw = Number(
      (dataNode as Record<string, unknown>)?.totalElements ??
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
