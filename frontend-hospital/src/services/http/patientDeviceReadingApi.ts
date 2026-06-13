import type { DeviceType } from '@bluetooth/bluetooth/deviceRegistry';
import type { BluetoothReading } from '@bluetooth/bluetooth/types';
import { parsePagedEntityList, pickString } from '@saas-builder/hospital-api-client';
import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';

export type PatientDeviceReadingDto = {
  externalId: string;
  deviceKey: string;
  deviceName: string | null;
  deviceType: string;
  measurements: Record<string, number | null>;
  recordedAt: string;
  createdAt: string;
  childProfileExternalId?: string | null;
  appointmentExternalId?: string | null;
};

export type SavePatientDeviceReadingInput = {
  deviceKey: string;
  deviceName: string;
  deviceType: DeviceType | string;
  measurements: Record<string, number | null>;
  recordedAt: string;
  rawBytes?: Uint8Array;
  childProfileExternalId?: string;
  appointmentExternalId?: string;
};

export type ListPatientDeviceReadingsOptions = {
  page?: number;
  size?: number;
  childProfileExternalId?: string;
  deviceType?: string;
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function parsePatientDeviceReading(row: Record<string, unknown>): PatientDeviceReadingDto {
  const measurementsRaw = (row.Measurements ?? row.measurements ?? {}) as Record<string, unknown>;
  const measurements: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(measurementsRaw)) {
    if (value == null || value === '') {
      measurements[key] = null;
    } else if (typeof value === 'number') {
      measurements[key] = value;
    } else {
      const parsed = Number(value);
      measurements[key] = Number.isFinite(parsed) ? parsed : null;
    }
  }
  return {
    externalId: pickString(row, ['ExternalId', 'externalId']),
    deviceKey: pickString(row, ['DeviceKey', 'deviceKey']),
    deviceName: pickString(row, ['DeviceName', 'deviceName']) || null,
    deviceType: pickString(row, ['DeviceType', 'deviceType']),
    measurements,
    recordedAt: pickString(row, ['RecordedAt', 'recordedAt']),
    createdAt: pickString(row, ['CreatedAt', 'createdAt']),
    childProfileExternalId: pickString(row, ['ChildProfileExternalId', 'childProfileExternalId']) || null,
    appointmentExternalId: pickString(row, ['AppointmentExternalId', 'appointmentExternalId']) || null
  };
}

export function dtoToBluetoothReading(dto: PatientDeviceReadingDto): BluetoothReading {
  return {
    deviceKey: dto.deviceKey,
    deviceName: dto.deviceName ?? dto.deviceKey,
    deviceType: dto.deviceType as DeviceType,
    measurements: dto.measurements ?? {},
    timestamp: dto.recordedAt
  };
}

export async function savePatientDeviceReading(
  input: SavePatientDeviceReadingInput
): Promise<PatientDeviceReadingDto> {
  const body: Record<string, unknown> = {
    DeviceKey: input.deviceKey,
    DeviceName: input.deviceName,
    DeviceType: input.deviceType,
    Measurements: input.measurements,
    RecordedAt: input.recordedAt
  };
  if (input.rawBytes && input.rawBytes.length > 0) {
    body.RawBytesBase64 = bytesToBase64(input.rawBytes);
  }
  if (input.childProfileExternalId) {
    body.ChildProfileExternalId = input.childProfileExternalId;
  }
  if (input.appointmentExternalId) {
    body.AppointmentExternalId = input.appointmentExternalId;
  }
  const res = await apiClient.post(`${SERVER_PATHS.patientDeviceReadings}/save`, body);
  const data = readEnvelope<Record<string, unknown>>(res.data);
  return parsePatientDeviceReading(data);
}

export async function listPatientDeviceReadings(
  options: ListPatientDeviceReadingsOptions = {}
): Promise<PatientDeviceReadingDto[]> {
  const page = options.page ?? 0;
  const size = options.size ?? 20;
  const query: Record<string, string> = {};
  if (options.childProfileExternalId) {
    query.ChildProfileExternalId = options.childProfileExternalId;
  }
  if (options.deviceType) {
    query.DeviceType = options.deviceType;
  }
  const params: Record<string, unknown> = {
    page,
    size,
    sort: 'recordedAt,desc'
  };
  if (Object.keys(query).length > 0) {
    params.Query = JSON.stringify(query);
  }
  const res = await apiClient.get(SERVER_PATHS.patientDeviceReadings, { params });
  const parsed = parsePagedEntityList(res.data, (row) =>
    parsePatientDeviceReading(row as Record<string, unknown>)
  );
  return parsed.items;
}
