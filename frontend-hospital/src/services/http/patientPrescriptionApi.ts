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
    extractedData: mapExtractedData(extracted)
  };
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
