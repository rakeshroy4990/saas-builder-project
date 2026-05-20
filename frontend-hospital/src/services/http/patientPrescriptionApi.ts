import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';

export type PatientPrescriptionStatus = 'pending' | 'processing' | 'verified' | 'rejected';

export type PatientPrescriptionListItem = {
  externalId: string;
  status: PatientPrescriptionStatus;
  mimeType: string;
  fileSizeBytes: number | null;
  createdAt: string;
  isDuplicate?: boolean;
  doctorName?: string;
  department?: string;
  patientName?: string;
  gender?: string;
  extractedData?: PatientPrescriptionExtractedData;
  groupExternalId?: string;
  pageNumber?: number;
  isPrimaryPage?: boolean;
  groupType?: 'multi_page' | 'diagnosis' | 'chronic';
  sharedDiagnosis?: string;
};

export type PatientPrescriptionDiagnosisGroupSummary = {
  groupExternalId: string;
  sharedDiagnosis: string;
  label: string;
  prescriptionCount: number;
  createdAt: string;
};

export type PatientPrescriptionGroupCreateResult = {
  groupExternalId: string;
};

export type PatientPrescriptionExtractedData = {
  hospitalName?: string;
  documentType?: string;
  registrationNumber?: string;
  receiptNumber?: string;
  appointmentDate?: string;
  patientName?: string;
  patientAge?: string;
  patientGender?: string;
  ageGender?: string;
  department?: string;
  consultant?: string;
  address?: string;
  mobileNumber?: string;
  referredBy?: string;
  diagnosis?: string;
  medicines?: string[];
  dosage?: string[];
  advice?: string[];
  doctorName?: string;
  prescriptionDate?: string;
  notes?: string;
};

export type PatientPrescriptionUploadResult = {
  externalId: string;
  isDuplicate: boolean;
  status: string;
};

export type PatientPrescriptionDownloadResult = {
  signedUrl: string;
  expiresIn: number;
};

function readEnvelope<T>(data: unknown): T {
  const root = data as Record<string, unknown>;
  const ok = Boolean(root?.success ?? root?.Success);
  if (!ok) {
    const msg = String(root?.message ?? root?.Message ?? 'Request failed').trim();
    const code = String(root?.errorCode ?? root?.ErrorCode ?? '').trim();
    const err = new Error(msg || 'Request failed');
    (err as Error & { errorCode?: string }).errorCode = code || undefined;
    throw err;
  }
  return (root?.data ?? root?.Data) as T;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return undefined;
}

function pickStringArray(obj: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0) {
      return v.map((item) => String(item));
    }
  }
  return undefined;
}

function mapExtractedData(raw: Record<string, unknown> | undefined): PatientPrescriptionExtractedData | undefined {
  if (!raw) return undefined;
  const data: PatientPrescriptionExtractedData = {
    hospitalName: pickString(raw, 'hospitalName', 'hospital_name'),
    documentType: pickString(raw, 'documentType', 'document_type'),
    registrationNumber: pickString(raw, 'registrationNumber', 'registration_number'),
    receiptNumber: pickString(raw, 'receiptNumber', 'receipt_number'),
    appointmentDate: pickString(raw, 'appointmentDate', 'appointment_date'),
    patientName: pickString(raw, 'patientName', 'patient_name'),
    patientAge: pickString(raw, 'patientAge', 'patient_age'),
    patientGender: pickString(raw, 'patientGender', 'patient_gender'),
    ageGender: pickString(raw, 'ageGender', 'age_gender'),
    department: pickString(raw, 'department'),
    consultant: pickString(raw, 'consultant'),
    address: pickString(raw, 'address'),
    mobileNumber: pickString(raw, 'mobileNumber', 'mobile_number'),
    referredBy: pickString(raw, 'referredBy', 'referred_by'),
    diagnosis: pickString(raw, 'diagnosis', 'Diagnosis'),
    medicines: pickStringArray(raw, 'medicines', 'Medicines'),
    dosage: pickStringArray(raw, 'dosage', 'Dosage'),
    advice: pickStringArray(raw, 'advice', 'Advice'),
    doctorName: pickString(raw, 'doctorName', 'doctor_name', 'DoctorName'),
    prescriptionDate: pickString(raw, 'prescriptionDate', 'prescription_date', 'PrescriptionDate'),
    notes: pickString(raw, 'notes', 'Notes')
  };
  const hasAny = Object.values(data).some((v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ''));
  return hasAny ? data : undefined;
}

function mapListItem(raw: Record<string, unknown>): PatientPrescriptionListItem {
  const extracted = (raw.extractedData ?? raw.ExtractedData) as Record<string, unknown> | undefined;
  return {
    externalId: String(raw.externalId ?? raw.ExternalId ?? '').trim(),
    status: String(raw.status ?? raw.Status ?? 'pending').trim().toLowerCase() as PatientPrescriptionStatus,
    mimeType: String(raw.mimeType ?? raw.MimeType ?? '').trim(),
    fileSizeBytes:
      raw.fileSizeBytes != null || raw.FileSizeBytes != null
        ? Number(raw.fileSizeBytes ?? raw.FileSizeBytes)
        : null,
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? '').trim(),
    doctorName: pickString(raw, 'doctorName', 'doctor_name'),
    department: pickString(raw, 'department'),
    patientName: pickString(raw, 'patientName', 'patient_name'),
    gender: pickString(raw, 'gender', 'patientGender', 'patient_gender'),
    extractedData: mapExtractedData(extracted),
    groupExternalId: pickString(raw, 'groupExternalId', 'group_external_id'),
    pageNumber:
      raw.pageNumber != null || raw.PageNumber != null
        ? Number(raw.pageNumber ?? raw.PageNumber)
        : undefined,
    isPrimaryPage:
      raw.isPrimaryPage != null || raw.IsPrimaryPage != null
        ? Boolean(raw.isPrimaryPage ?? raw.IsPrimaryPage)
        : undefined,
    groupType: pickString(raw, 'groupType', 'group_type') as PatientPrescriptionListItem['groupType'],
    sharedDiagnosis: pickString(raw, 'sharedDiagnosis', 'shared_diagnosis')
  };
}

/** Display merge for diagnosis-linked prescriptions (shared diagnosis + combined meds). */
export function mergeDiagnosisGroupExtractedData(
  pages: PatientPrescriptionListItem[],
  sharedDiagnosis?: string
): PatientPrescriptionExtractedData | undefined {
  if (!pages.length && !sharedDiagnosis?.trim()) return undefined;
  const diagnosis = String(sharedDiagnosis ?? pages[0]?.sharedDiagnosis ?? '').trim()
    || pages.map((p) => p.extractedData?.diagnosis).find(Boolean)
    || '';
  const medicines: string[] = [];
  const dosage: string[] = [];
  const advice: string[] = [];
  const notes: string[] = [];
  let base: PatientPrescriptionExtractedData = {};
  for (const page of pages) {
    if (page.extractedData) {
      base = { ...base, ...page.extractedData };
      if (page.extractedData.medicines?.length) medicines.push(...page.extractedData.medicines);
      if (page.extractedData.dosage?.length) dosage.push(...page.extractedData.dosage);
      if (page.extractedData.advice?.length) advice.push(...page.extractedData.advice);
      if (page.extractedData.notes) notes.push(page.extractedData.notes);
    }
  }
  const merged: PatientPrescriptionExtractedData = {
    ...base,
    diagnosis: diagnosis || base.diagnosis,
    medicines: [...new Set(medicines)],
    dosage: [...new Set(dosage)],
    advice: [...new Set(advice)],
    notes: [...new Set(notes)].join(' · ') || undefined
  };
  const hasAny = Object.values(merged).some((v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ''));
  return hasAny ? merged : undefined;
}

/** Merge front (primary) + back page extracted fields into one summary for display. */
export function mergeMultiPageExtractedData(
  pages: PatientPrescriptionListItem[]
): PatientPrescriptionExtractedData | undefined {
  if (!pages.length) return undefined;
  const ordered = [...pages].sort((a, b) => (a.pageNumber ?? 99) - (b.pageNumber ?? 99));
  const primary = ordered.find((p) => p.isPrimaryPage) ?? ordered[0];
  const back = ordered.find((p) => p !== primary && (p.pageNumber ?? 0) > 1) ?? ordered[1];
  const frontEx = primary?.extractedData;
  const backEx = back?.extractedData;
  if (!frontEx && !backEx) return undefined;
  const merged: PatientPrescriptionExtractedData = {
    ...(frontEx ?? {}),
    diagnosis: frontEx?.diagnosis || backEx?.diagnosis,
    medicines: [...(frontEx?.medicines ?? []), ...(backEx?.medicines ?? [])].filter(
      (v, i, arr) => arr.indexOf(v) === i
    ),
    dosage: [...(frontEx?.dosage ?? []), ...(backEx?.dosage ?? [])].filter(
      (v, i, arr) => arr.indexOf(v) === i
    ),
    advice: [...(frontEx?.advice ?? []), ...(backEx?.advice ?? [])].filter(
      (v, i, arr) => arr.indexOf(v) === i
    ),
    notes: [frontEx?.notes, backEx?.notes].filter(Boolean).join(' · ') || undefined
  };
  const hasAny = Object.values(merged).some((v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ''));
  return hasAny ? merged : undefined;
}

export async function createPatientPrescriptionGroup(options?: {
  label?: string;
  groupType?: 'multi_page' | 'diagnosis' | 'chronic';
  sharedDiagnosis?: string;
}): Promise<PatientPrescriptionGroupCreateResult> {
  const res = await apiClient.post<unknown>(`${SERVER_PATHS.patientPrescriptions}/groups`, {
    label: options?.label ?? '',
    groupType: options?.groupType ?? 'multi_page',
    sharedDiagnosis: options?.sharedDiagnosis ?? ''
  });
  const data = readEnvelope<Record<string, unknown>>(res.data);
  return {
    groupExternalId: String(data.groupExternalId ?? data.GroupExternalId ?? '').trim()
  };
}

export async function listPatientPrescriptionGroup(
  groupExternalId: string
): Promise<PatientPrescriptionListItem[]> {
  const path = `${SERVER_PATHS.patientPrescriptions}/groups/${encodeURIComponent(groupExternalId)}`;
  const res = await apiClient.get<unknown>(path);
  const data = readEnvelope<unknown>(res.data);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map(mapListItem);
}

export async function listPatientDiagnosisGroups(): Promise<PatientPrescriptionDiagnosisGroupSummary[]> {
  const res = await apiClient.get<unknown>(`${SERVER_PATHS.patientPrescriptions}/groups/diagnosis`);
  const data = readEnvelope<unknown>(res.data);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((raw) => ({
      groupExternalId: String(raw.groupExternalId ?? raw.GroupExternalId ?? '').trim(),
      sharedDiagnosis: String(raw.sharedDiagnosis ?? raw.SharedDiagnosis ?? '').trim(),
      label: String(raw.label ?? raw.Label ?? '').trim(),
      prescriptionCount: Number(raw.prescriptionCount ?? raw.PrescriptionCount ?? 0),
      createdAt: String(raw.createdAt ?? raw.CreatedAt ?? '').trim()
    }))
    .filter((g) => g.groupExternalId);
}

export async function linkPatientPrescriptionToGroup(
  groupExternalId: string,
  prescriptionExternalId: string,
  pageNumber?: number
): Promise<void> {
  const path = `${SERVER_PATHS.patientPrescriptions}/groups/${encodeURIComponent(groupExternalId)}/link`;
  const body: { prescriptionExternalId: string; pageNumber?: number } = { prescriptionExternalId };
  if (pageNumber != null && pageNumber > 0) {
    body.pageNumber = pageNumber;
  }
  await apiClient.post<unknown>(path, body);
}

export async function uploadPatientPrescriptionFile(
  file: File,
  options?: { groupExternalId?: string; pageNumber?: number; appointmentExternalId?: string }
): Promise<PatientPrescriptionUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.groupExternalId) {
    formData.append('groupExternalId', options.groupExternalId);
  }
  if (options?.pageNumber != null) {
    formData.append('pageNumber', String(options.pageNumber));
  }
  if (options?.appointmentExternalId) {
    formData.append('appointmentExternalId', options.appointmentExternalId);
  }
  const res = await apiClient.post<unknown>(SERVER_PATHS.patientPrescriptionsUpload, formData);
  const data = readEnvelope<Record<string, unknown>>(res.data);
  return {
    externalId: String(data.externalId ?? data.ExternalId ?? '').trim(),
    isDuplicate: Boolean(data.isDuplicate ?? data.IsDuplicate),
    status: String(data.status ?? data.Status ?? '').trim()
  };
}

export async function listPatientPrescriptions(page = 0, size = 20): Promise<{
  items: PatientPrescriptionListItem[];
  totalElements: number;
}> {
  const res = await apiClient.get<unknown>(SERVER_PATHS.patientPrescriptions, {
    params: { page, size, sort: 'createdAt,desc' }
  });
  const data = readEnvelope<Record<string, unknown>>(res.data);
  const content = (data.content ?? data.Content ?? data.items ?? data.Items) as unknown[];
  const items = Array.isArray(content)
    ? content
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(mapListItem)
    : [];
  const totalElements = Number(data.totalElements ?? data.TotalElements ?? items.length);
  return { items, totalElements };
}

export async function getPatientPrescriptionDownloadUrl(externalId: string): Promise<PatientPrescriptionDownloadResult> {
  const path = `${SERVER_PATHS.patientPrescriptions}/${encodeURIComponent(externalId)}/download`;
  const res = await apiClient.get<unknown>(path);
  const data = readEnvelope<Record<string, unknown>>(res.data);
  return {
    signedUrl: String(data.signedUrl ?? data.SignedUrl ?? '').trim(),
    expiresIn: Number(data.expiresIn ?? data.ExpiresIn ?? 900)
  };
}
