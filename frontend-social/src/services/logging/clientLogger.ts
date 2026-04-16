import { URLRegistry } from '../http/URLRegistry';
import { getOrCreateTraceId } from './traceContext';

export type ClientLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ClientLogEntry {
  id?: number;
  traceId: string;
  level: ClientLogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface LogBatchRequest {
  traceId: string;
  entries: ClientLogEntry[];
}

const DB_NAME = 'flexshell-logs-db';
const STORE_NAME = 'logs';
const DB_VERSION = 1;
const LEVEL_KEY = 'flexshell-ui-log-level';
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

const levelPriority: Record<ClientLogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

let syncTimer: number | null = null;
let syncInFlight = false;

function defaultLevel(): ClientLogLevel {
  return import.meta.env.DEV ? 'DEBUG' : 'INFO';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addLog(entry: ClientLogEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readBatch(limit = 200): Promise<ClientLogEntry[]> {
  const db = await openDb();
  const rows = await new Promise<ClientLogEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as ClientLogEntry[]).slice(0, limit));
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

async function deleteBatch(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function getClientLogLevel(): ClientLogLevel {
  const value = localStorage.getItem(LEVEL_KEY) as ClientLogLevel | null;
  if (!value || !(value in levelPriority)) return defaultLevel();
  return value;
}

export function setClientLogLevel(level: ClientLogLevel): void {
  localStorage.setItem(LEVEL_KEY, level);
}

function shouldLog(level: ClientLogLevel): boolean {
  return levelPriority[level] >= levelPriority[getClientLogLevel()];
}

export async function syncLogsNow(): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    const entries = await readBatch();
    if (!entries.length) return;
    const payload: LogBatchRequest = {
      traceId: getOrCreateTraceId(),
      entries
    };
    const response = await URLRegistry.request('logsBatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return;
    const ids = entries.map((e) => e.id).filter((v): v is number => typeof v === 'number');
    await deleteBatch(ids);
  } catch {
    // Keep logs in IndexedDB for next retry.
  } finally {
    syncInFlight = false;
  }
}

export async function logClient(
  level: ClientLogLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!shouldLog(level)) return;
  const entry: ClientLogEntry = {
    traceId: getOrCreateTraceId(),
    level,
    message,
    timestamp: new Date().toISOString(),
    context
  };
  const out = `[${entry.level}] [${entry.traceId}] ${entry.message}`;
  if (level === 'ERROR') console.error(out, context ?? {});
  else if (level === 'WARN') console.warn(out, context ?? {});
  else if (level === 'DEBUG') console.debug(out, context ?? {});
  else console.info(out, context ?? {});

  await addLog(entry);
  if (level === 'ERROR' || level === 'WARN') {
    void syncLogsNow();
  }
}

export function startLogSyncScheduler(): void {
  if (syncTimer != null) return;
  syncTimer = window.setInterval(() => {
    void syncLogsNow();
  }, FIFTEEN_MIN_MS);
}

export async function syncServerLogLevel(level: ClientLogLevel): Promise<boolean> {
  try {
    const response = await URLRegistry.request('logsLevel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ level })
    });
    return response.ok;
  } catch {
    return false;
  }
}

