import { apiClient } from '@/api/client';
import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

export type DeviceReadingRow = {
  externalId: string;
  deviceType: string;
  deviceName: string;
  measurements: Record<string, unknown>;
  recordedAt: string;
};

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function parseRow(row: Record<string, unknown>): DeviceReadingRow {
  const measurementsRaw = (row.Measurements ?? row.measurements ?? {}) as Record<string, unknown>;
  return {
    externalId: pickString(row, ['ExternalId', 'externalId']),
    deviceType: pickString(row, ['DeviceType', 'deviceType']),
    deviceName: pickString(row, ['DeviceName', 'deviceName']),
    measurements: measurementsRaw,
    recordedAt: pickString(row, ['RecordedAt', 'recordedAt'])
  };
}

export async function listDeviceReadingsMobile(childProfileExternalId?: string): Promise<DeviceReadingRow[]> {
  const query: Record<string, string> = {};
  if (childProfileExternalId) {
    query.ChildProfileExternalId = childProfileExternalId;
  }
  const params: Record<string, unknown> = { page: 0, size: 50, sort: 'recordedAt,desc' };
  if (Object.keys(query).length > 0) {
    params.Query = JSON.stringify(query);
  }
  const res = await apiClient.get(SERVER_PATHS.patientDeviceReadings, { params });
  const envelope = res.data as Record<string, unknown>;
  const rows = envelope.Data;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => parseRow(row as Record<string, unknown>));
}

export async function saveDeviceReadingMobile(payload: Record<string, unknown>) {
  const res = await apiClient.post(`${SERVER_PATHS.patientDeviceReadings}/save`, payload);
  return res.data;
}
