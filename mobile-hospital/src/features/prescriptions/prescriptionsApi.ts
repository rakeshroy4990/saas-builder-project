import {
  isEnvelopeSuccess,
  pickString,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';

import { postMultipartLocalFile } from '@/api/postMultipart';
import { apiClient } from '@/api/client';

import type {
  PrescriptionExtractedData,
  PrescriptionItem,
  PrescriptionStatus,
  PrescriptionUploadResult
} from './types';

const UPLOAD_PATH = `${SERVER_PATHS.patientPrescriptions}/upload`;

function pickStringArray(obj: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0) {
      return v.map((item) => String(item).trim()).filter(Boolean);
    }
  }
  return undefined;
}

function mapExtractedData(raw: Record<string, unknown> | undefined): PrescriptionExtractedData | undefined {
  if (!raw) return undefined;
  const data: PrescriptionExtractedData = {
    patientName: pickString(raw, 'patientName', 'patient_name', 'PatientName'),
    doctorName: pickString(raw, 'doctorName', 'doctor_name', 'DoctorName'),
    consultant: pickString(raw, 'consultant', 'Consultant'),
    diagnosis: pickString(raw, 'diagnosis', 'Diagnosis'),
    medicines: pickStringArray(raw, 'medicines', 'Medicines'),
    prescriptionDate: pickString(raw, 'prescriptionDate', 'prescription_date', 'PrescriptionDate'),
    appointmentDate: pickString(raw, 'appointmentDate', 'appointment_date', 'AppointmentDate'),
    department: pickString(raw, 'department', 'Department')
  };
  const hasAny = Object.values(data).some(
    (v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== '')
  );
  return hasAny ? data : undefined;
}

function mapListItem(row: Record<string, unknown>, index: number): PrescriptionItem {
  const extracted = (row.extractedData ?? row.ExtractedData) as Record<string, unknown> | undefined;
  const statusRaw = pickString(row, ['status', 'Status']) ?? 'pending';
  return {
    id: pickString(row, ['externalId', 'external_id', 'ExternalId', 'id', 'Id']) || `rx-${index}`,
    status: statusRaw.toLowerCase() as PrescriptionStatus,
    createdAt: pickString(row, ['createdAt', 'CreatedAt', 'uploadedAt', 'UploadedAt']) ?? '',
    mimeType: pickString(row, ['mimeType', 'MimeType']) ?? '',
    doctorName: pickString(row, ['doctorName', 'doctor_name', 'DoctorName']),
    patientName: pickString(row, ['patientName', 'patient_name', 'PatientName']),
    department: pickString(row, ['department', 'Department']),
    sharedDiagnosis: pickString(row, ['sharedDiagnosis', 'shared_diagnosis', 'SharedDiagnosis']),
    extractedData: mapExtractedData(extracted)
  };
}

export async function fetchPrescriptionsPage(page = 0, size = 20): Promise<PrescriptionItem[]> {
  const response = await apiClient.get(SERVER_PATHS.patientPrescriptions, {
    params: { page, size, sort: 'createdAt,desc' }
  });
  const data = unwrapEnvelope<Record<string, unknown>>(response.data);
  const content = (data.content ?? data.Content ?? data.items ?? data.Items ?? []) as unknown[];
  if (!Array.isArray(content)) return [];
  return content
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
    .map((row, index) => mapListItem(row, index));
}

export async function uploadPatientPrescriptionFile(
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<PrescriptionUploadResult> {
  const raw = await postMultipartLocalFile(UPLOAD_PATH, fileUri, fileName, mimeType);
  const envelope = raw as Record<string, unknown>;
  if (envelope && typeof envelope === 'object' && ('success' in envelope || 'Success' in envelope)) {
    if (!isEnvelopeSuccess(envelope)) {
      throw new Error(pickString(envelope, ['message', 'Message']) || 'Upload failed');
    }
    const data = unwrapEnvelope<Record<string, unknown>>(envelope);
    return {
      externalId: pickString(data, ['externalId', 'ExternalId']) ?? '',
      isDuplicate: Boolean(data.isDuplicate ?? data.IsDuplicate),
      status: pickString(data, ['status', 'Status']) ?? ''
    };
  }
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    externalId: pickString(data, ['externalId', 'ExternalId']) ?? '',
    isDuplicate: Boolean(data.isDuplicate ?? data.IsDuplicate),
    status: pickString(data, ['status', 'Status']) ?? ''
  };
}
