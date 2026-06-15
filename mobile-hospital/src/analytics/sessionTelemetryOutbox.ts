import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';

const OUTBOX_PATH = `${cacheDirectory ?? ''}session_telemetry_outbox.json`;
const MAX_RECORDS = 500;

type OutboxRecord = {
  enqueuedAt: number;
  body: string;
};

async function readOutbox(): Promise<OutboxRecord[]> {
  if (!cacheDirectory) return [];
  try {
    const raw = await readAsStringAsync(OUTBOX_PATH);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is OutboxRecord =>
        row != null &&
        typeof row === 'object' &&
        typeof (row as OutboxRecord).body === 'string' &&
        typeof (row as OutboxRecord).enqueuedAt === 'number'
    );
  } catch {
    return [];
  }
}

async function writeOutbox(records: OutboxRecord[]): Promise<void> {
  if (!cacheDirectory) return;
  const trimmed = records.length > MAX_RECORDS ? records.slice(-MAX_RECORDS) : records;
  await writeAsStringAsync(OUTBOX_PATH, JSON.stringify(trimmed));
}

/** Persist one telemetry POST body so it can be sent after a fatal crash / app kill. */
export async function enqueueTelemetryBody(body: string): Promise<void> {
  if (!body.trim() || !cacheDirectory) return;
  try {
    const records = await readOutbox();
    records.push({ enqueuedAt: Date.now(), body });
    await writeOutbox(records);
  } catch {
    // Non-blocking
  }
}

export async function readOutboxBodies(): Promise<string[]> {
  return (await readOutbox()).map((row) => row.body);
}

export async function removeOutboxBodies(count: number): Promise<void> {
  if (count <= 0) return;
  try {
    const records = await readOutbox();
    await writeOutbox(records.slice(count));
  } catch {
    // Non-blocking
  }
}
