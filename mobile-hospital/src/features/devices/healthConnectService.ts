import { Linking, Platform } from 'react-native';

export type HealthConnectAvailability =
  | 'unsupported_platform'
  | 'module_unavailable'
  | 'sdk_unavailable'
  | 'needs_provider_update'
  | 'ready';

export type HealthConnectPermissionResult = {
  availability: HealthConnectAvailability;
  granted: boolean;
  message?: string;
};

const HEALTH_READ_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'RestingHeartRate' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'OxygenSaturation' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'TotalCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'FloorsClimbed' as const }
];

export type HealthConnectDaySnapshot = {
  date: string;
  recordedAt: string;
  steps?: number;
  distanceMeters?: number;
  activeCalories?: number;
  totalCalories?: number;
  heartRateAvg?: number;
  heartRateMin?: number;
  heartRateMax?: number;
  restingHeartRate?: number;
  sleepMinutes?: number;
  spo2Avg?: number;
  floorsClimbed?: number;
};

async function loadHealthConnectModule() {
  try {
    return await import('react-native-health-connect');
  } catch {
    return null;
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function startDaysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function ensureDay(map: Map<string, HealthConnectDaySnapshot>, key: string): HealthConnectDaySnapshot {
  let row = map.get(key);
  if (!row) {
    row = {
      date: key,
      recordedAt: `${key}T23:59:59.000Z`
    };
    map.set(key, row);
  }
  return row;
}

function avg(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export async function getHealthConnectAvailability(): Promise<HealthConnectAvailability> {
  if (Platform.OS !== 'android') return 'unsupported_platform';
  const hc = await loadHealthConnectModule();
  if (!hc) return 'module_unavailable';
  try {
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'sdk_unavailable';
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'needs_provider_update';
    }
    return 'ready';
  } catch {
    return 'module_unavailable';
  }
}

export async function openHealthConnectInstall(): Promise<void> {
  const hc = await loadHealthConnectModule();
  if (hc) {
    try {
      if (typeof hc.openHealthConnectSettings === 'function') {
        await hc.openHealthConnectSettings();
        return;
      }
    } catch {
      // fall through
    }
  }
  await Linking.openURL('market://details?id=com.google.android.apps.healthdata');
}

export async function openHealthConnectSettings(): Promise<void> {
  const hc = await loadHealthConnectModule();
  if (hc && typeof hc.openHealthConnectSettings === 'function') {
    await hc.openHealthConnectSettings();
    return;
  }
  await openHealthConnectInstall();
}

export async function requestHealthConnectAccess(): Promise<HealthConnectPermissionResult> {
  const availability = await getHealthConnectAvailability();
  if (availability === 'unsupported_platform') {
    return { availability, granted: false, message: 'HEALTH_CONNECT_IOS_ONLY' };
  }
  if (availability === 'module_unavailable') {
    return { availability, granted: false, message: 'HEALTH_CONNECT_DEV_BUILD_REQUIRED' };
  }
  if (availability === 'sdk_unavailable') {
    return { availability, granted: false, message: 'HEALTH_CONNECT_NOT_INSTALLED' };
  }
  if (availability === 'needs_provider_update') {
    return { availability, granted: false, message: 'HEALTH_CONNECT_UPDATE_REQUIRED' };
  }

  const hc = await loadHealthConnectModule();
  if (!hc) {
    return { availability: 'module_unavailable', granted: false, message: 'HEALTH_CONNECT_DEV_BUILD_REQUIRED' };
  }

  try {
    const initialized = await hc.initialize();
    if (!initialized) {
      return { availability: 'ready', granted: false, message: 'HEALTH_CONNECT_INIT_FAILED' };
    }
    const granted = await hc.requestPermission(HEALTH_READ_PERMISSIONS);
    const ok = Array.isArray(granted) && granted.length > 0;
    return { availability: 'ready', granted: ok };
  } catch {
    return { availability: 'ready', granted: false, message: 'HEALTH_CONNECT_PERMISSION_DENIED' };
  }
}

async function readRecords<T>(recordType: string, startTime: string, endTime: string): Promise<T[]> {
  const hc = await loadHealthConnectModule();
  if (!hc) return [];
  try {
    const result = await hc.readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime, endTime }
    });
    return ((result as { records?: T[] }).records ?? []) as T[];
  } catch {
    return [];
  }
}

/** Read up to {@link days} daily snapshots from Health Connect (Android). */
export async function readHealthConnectHistory(days = 7): Promise<HealthConnectDaySnapshot[]> {
  const availability = await getHealthConnectAvailability();
  if (availability !== 'ready') return [];
  const hc = await loadHealthConnectModule();
  if (!hc) return [];

  try {
    await hc.initialize();
    const startTime = startDaysAgoIso(Math.max(1, days));
    const endTime = new Date().toISOString();
    const byDay = new Map<string, HealthConnectDaySnapshot>();

    const stepRecords = await readRecords<{ count?: number; startTime?: string; endTime?: string }>(
      'Steps',
      startTime,
      endTime
    );
    for (const row of stepRecords) {
      const key = dayKey(row.endTime ?? row.startTime ?? endTime);
      const day = ensureDay(byDay, key);
      day.steps = (day.steps ?? 0) + (row.count ?? 0);
    }

    const distanceRecords = await readRecords<{ distance?: { inMeters?: number }; startTime?: string; endTime?: string }>(
      'Distance',
      startTime,
      endTime
    );
    for (const row of distanceRecords) {
      const key = dayKey(row.endTime ?? row.startTime ?? endTime);
      const day = ensureDay(byDay, key);
      day.distanceMeters = (day.distanceMeters ?? 0) + (row.distance?.inMeters ?? 0);
    }

    const activeCalRecords = await readRecords<{ energy?: { inKilocalories?: number }; startTime?: string; endTime?: string }>(
      'ActiveCaloriesBurned',
      startTime,
      endTime
    );
    for (const row of activeCalRecords) {
      const key = dayKey(row.endTime ?? row.startTime ?? endTime);
      const day = ensureDay(byDay, key);
      day.activeCalories = Math.round((day.activeCalories ?? 0) + (row.energy?.inKilocalories ?? 0));
    }

    const totalCalRecords = await readRecords<{ energy?: { inKilocalories?: number }; startTime?: string; endTime?: string }>(
      'TotalCaloriesBurned',
      startTime,
      endTime
    );
    for (const row of totalCalRecords) {
      const key = dayKey(row.endTime ?? row.startTime ?? endTime);
      const day = ensureDay(byDay, key);
      day.totalCalories = Math.round((day.totalCalories ?? 0) + (row.energy?.inKilocalories ?? 0));
    }

    const floorRecords = await readRecords<{ floors?: number; startTime?: string; endTime?: string }>(
      'FloorsClimbed',
      startTime,
      endTime
    );
    for (const row of floorRecords) {
      const key = dayKey(row.endTime ?? row.startTime ?? endTime);
      const day = ensureDay(byDay, key);
      day.floorsClimbed = (day.floorsClimbed ?? 0) + (row.floors ?? 0);
    }

    const heartRecords = await readRecords<{
      samples?: Array<{ beatsPerMinute?: number; time?: string }>;
      startTime?: string;
      endTime?: string;
    }>('HeartRate', startTime, endTime);
    const heartByDay = new Map<string, number[]>();
    for (const row of heartRecords) {
      for (const sample of row.samples ?? []) {
        if (sample.beatsPerMinute == null || !Number.isFinite(sample.beatsPerMinute)) continue;
        const key = dayKey(sample.time ?? row.endTime ?? row.startTime ?? endTime);
        const list = heartByDay.get(key) ?? [];
        list.push(sample.beatsPerMinute);
        heartByDay.set(key, list);
      }
    }
    for (const [key, values] of heartByDay) {
      const day = ensureDay(byDay, key);
      day.heartRateAvg = avg(values);
      day.heartRateMin = Math.min(...values);
      day.heartRateMax = Math.max(...values);
    }

    const restingRecords = await readRecords<{ beatsPerMinute?: number; time?: string }>(
      'RestingHeartRate',
      startTime,
      endTime
    );
    for (const row of restingRecords) {
      if (row.beatsPerMinute == null) continue;
      const key = dayKey(row.time ?? endTime);
      ensureDay(byDay, key).restingHeartRate = row.beatsPerMinute;
    }

    const sleepRecords = await readRecords<{ startTime?: string; endTime?: string }>(
      'SleepSession',
      startTime,
      endTime
    );
    for (const row of sleepRecords) {
      if (!row.startTime || !row.endTime) continue;
      const key = dayKey(row.endTime);
      const mins = Math.round((new Date(row.endTime).getTime() - new Date(row.startTime).getTime()) / 60000);
      if (mins <= 0) continue;
      const day = ensureDay(byDay, key);
      day.sleepMinutes = (day.sleepMinutes ?? 0) + mins;
    }

    const spo2Records = await readRecords<{ percentage?: number; time?: string }>(
      'OxygenSaturation',
      startTime,
      endTime
    );
    const spo2ByDay = new Map<string, number[]>();
    for (const row of spo2Records) {
      if (row.percentage == null || !Number.isFinite(row.percentage)) continue;
      const key = dayKey(row.time ?? endTime);
      const list = spo2ByDay.get(key) ?? [];
      list.push(row.percentage);
      spo2ByDay.set(key, list);
    }
    for (const [key, values] of spo2ByDay) {
      ensureDay(byDay, key).spo2Avg = avg(values);
    }

    return [...byDay.values()]
      .filter((row) =>
        row.steps != null ||
        row.distanceMeters != null ||
        row.activeCalories != null ||
        row.totalCalories != null ||
        row.heartRateAvg != null ||
        row.restingHeartRate != null ||
        row.sleepMinutes != null ||
        row.spo2Avg != null ||
        row.floorsClimbed != null
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/** @deprecated use readHealthConnectHistory */
export async function readLatestHealthConnectSamples(): Promise<HealthConnectDaySnapshot | null> {
  const rows = await readHealthConnectHistory(1);
  return rows[0] ?? null;
}

export function snapshotToMeasurements(snapshot: HealthConnectDaySnapshot): Record<string, number> {
  const measurements: Record<string, number> = {};
  if (snapshot.steps != null) measurements.steps = snapshot.steps;
  if (snapshot.distanceMeters != null) measurements.distance_meters = Math.round(snapshot.distanceMeters);
  if (snapshot.activeCalories != null) measurements.active_calories = snapshot.activeCalories;
  if (snapshot.totalCalories != null) measurements.total_calories = snapshot.totalCalories;
  if (snapshot.heartRateAvg != null) measurements.heart_rate_avg = snapshot.heartRateAvg;
  if (snapshot.heartRateMin != null) measurements.heart_rate_min = snapshot.heartRateMin;
  if (snapshot.heartRateMax != null) measurements.heart_rate_max = snapshot.heartRateMax;
  if (snapshot.restingHeartRate != null) measurements.resting_heart_rate = snapshot.restingHeartRate;
  if (snapshot.sleepMinutes != null) measurements.sleep_minutes = snapshot.sleepMinutes;
  if (snapshot.spo2Avg != null) measurements.spo2 = snapshot.spo2Avg;
  if (snapshot.floorsClimbed != null) measurements.floors_climbed = snapshot.floorsClimbed;
  return measurements;
}
