import { pickString, SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';

export interface PrescriptionItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export async function fetchPrescriptionsPage(page = 0, size = 20): Promise<PrescriptionItem[]> {
  const response = await apiClient.get(SERVER_PATHS.patientPrescriptions, {
    params: { page, size, sort: 'createdAt,desc' }
  });
  const data = unwrapEnvelope<Record<string, unknown>>(response.data);
  const content = (data.content ?? data.Content ?? data.items ?? []) as unknown[];
  if (!Array.isArray(content)) return [];
  return content.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      id: pickString(row, ['external_id', 'externalId', 'id', 'Id']) || `rx-${index}`,
      title:
        pickString(row, ['diagnosis', 'Diagnosis', 'fileName', 'FileName', 'title', 'Title']) ||
        'Prescription',
      status: pickString(row, ['status', 'Status']) || 'UPLOADED',
      createdAt: pickString(row, ['createdAt', 'CreatedAt', 'uploadedAt', 'UploadedAt'])
    };
  });
}
