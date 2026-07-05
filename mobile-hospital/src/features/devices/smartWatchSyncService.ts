import { apiClient } from '@/api/client';
import {
  readHealthConnectHistory,
  snapshotToMeasurements,
  type HealthConnectDaySnapshot
} from '@/features/devices/healthConnectService';
import type { SmartWatchPlatform } from '@/features/devices/smartWatchIntegration';
import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

export type SmartWatchSyncResult = {
  importedCount: number;
  snapshots: HealthConnectDaySnapshot[];
};

function pickString(body: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export async function syncSmartWatchFromHealthConnect(options: {
  platform: SmartWatchPlatform;
  childProfileExternalId?: string;
  days?: number;
}): Promise<SmartWatchSyncResult> {
  const days = options.days ?? 7;
  const snapshots = await readHealthConnectHistory(days);
  if (snapshots.length === 0) {
    return { importedCount: 0, snapshots: [] };
  }

  const readings = snapshots
    .map((snapshot) => ({
      RecordedAt: snapshot.recordedAt,
      Measurements: snapshotToMeasurements(snapshot)
    }))
    .filter((row) => Object.keys(row.Measurements).length > 0);

  const payload: Record<string, unknown> = {
    Platform: options.platform,
    Readings: readings
  };
  if (options.childProfileExternalId) {
    payload.ChildProfileExternalId = options.childProfileExternalId;
  }

  const res = await apiClient.post(SERVER_PATHS.patientDeviceReadingsSyncSmartWatch, payload);
  const envelope = res.data as Record<string, unknown>;
  const data = (envelope.Data ?? envelope.data ?? {}) as Record<string, unknown>;
  const importedRaw = data.ImportedCount ?? data.importedCount ?? readings.length;
  const importedCount = Number(importedRaw);
  return {
    importedCount: Number.isFinite(importedCount) ? importedCount : readings.length,
    snapshots
  };
}

export function formatSnapshotSummary(snapshot: HealthConnectDaySnapshot): string {
  const parts: string[] = [];
  if (snapshot.steps != null) parts.push(`${snapshot.steps} steps`);
  if (snapshot.heartRateAvg != null) parts.push(`${snapshot.heartRateAvg} bpm avg`);
  if (snapshot.restingHeartRate != null) parts.push(`${snapshot.restingHeartRate} bpm rest`);
  if (snapshot.sleepMinutes != null) parts.push(`${Math.round(snapshot.sleepMinutes / 60)}h sleep`);
  if (snapshot.spo2Avg != null) parts.push(`${snapshot.spo2Avg}% SpO₂`);
  if (snapshot.activeCalories != null) parts.push(`${snapshot.activeCalories} kcal`);
  return parts.join(' · ') || snapshot.date;
}

export function pickSyncMessage(body: unknown): string {
  const envelope = body as Record<string, unknown>;
  return pickString(envelope, ['Message', 'message']);
}
