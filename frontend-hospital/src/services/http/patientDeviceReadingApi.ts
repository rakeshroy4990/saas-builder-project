import type { DeviceType } from '@bluetooth/bluetooth/deviceRegistry';
import type { BluetoothReading } from '@bluetooth/bluetooth/types';
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
};

export type SavePatientDeviceReadingInput = {
  deviceKey: string;
  deviceName: string;
  deviceType: DeviceType | string;
  measurements: Record<string, number | null>;
  recordedAt: string;
  rawBytes?: Uint8Array;
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
    deviceKey: input.deviceKey,
    deviceName: input.deviceName,
    deviceType: input.deviceType,
    measurements: input.measurements,
    recordedAt: input.recordedAt
  };
  if (input.rawBytes && input.rawBytes.length > 0) {
    body.rawBytesBase64 = bytesToBase64(input.rawBytes);
  }
  const res = await apiClient.post(SERVER_PATHS.patientDeviceReadings, body);
  return readEnvelope<PatientDeviceReadingDto>(res.data);
}

export async function listPatientDeviceReadings(
  page = 0,
  size = 20
): Promise<PatientDeviceReadingDto[]> {
  const res = await apiClient.get(SERVER_PATHS.patientDeviceReadings, {
    params: { page, size, sort: 'recordedAt,desc' }
  });
  const pageData = readEnvelope<{ content?: PatientDeviceReadingDto[] }>(res.data);
  return Array.isArray(pageData?.content) ? pageData.content : [];
}
