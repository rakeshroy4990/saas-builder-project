/**
 * Buffers session telemetry POST bodies in IndexedDB and sends them in flush bursts
 * (logout / session expiry) instead of one HTTP request per UI/API event.
 */

import { URLRegistry } from '../http/URLRegistry';

const DB_NAME = 'flexshell_session_telemetry_v1';
const STORE = 'outbox';
const DB_VERSION = 1;
/** Avoid unbounded storage if the user never logs out. */
const MAX_RECORDS = 2000;

export type TelemetryOutboxRecord = {
  id?: number;
  enqueuedAt: number;
  /** JSON body for POST /api/telemetry/session-event */
  body: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }
  return dbPromise;
}

async function trimOldestIfNeeded(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    const countReq = os.count();
    countReq.onerror = () => reject(countReq.error);
    countReq.onsuccess = () => {
      const n = countReq.result;
      if (n <= MAX_RECORDS) {
        resolve();
        return;
      }
      const toDelete = n - MAX_RECORDS;
      const cur = os.openCursor();
      let deleted = 0;
      cur.onerror = () => reject(cur.error);
      cur.onsuccess = () => {
        const cursor = cur.result;
        if (!cursor || deleted >= toDelete) {
          resolve();
          return;
        }
        cursor.delete();
        deleted += 1;
        cursor.continue();
      };
    };
  });
}

/**
 * Append one serialized POST body. Drops oldest rows if over {@link MAX_RECORDS}.
 */
export async function enqueueTelemetryBody(body: string): Promise<void> {
  try {
    const db = await openDb();
    await trimOldestIfNeeded(db);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add({
        enqueuedAt: Date.now(),
        body
      } as Omit<TelemetryOutboxRecord, 'id'>);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } catch {
    // Non-blocking: telemetry must never break UX.
  }
}

type PostTelemetry = (body: string) => Promise<Response>;

let flushChain: Promise<void> = Promise.resolve();

async function deleteById(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

const BATCH_FLUSH_MAX = 100;

async function readOrderedRecords(db: IDBDatabase, limit: number): Promise<TelemetryOutboxRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    const out: TelemetryOutboxRecord[] = [];
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      if (out.length >= limit) {
        resolve(out);
        return;
      }
      out.push(cursor.value as TelemetryOutboxRecord);
      cursor.continue();
    };
  });
}

async function deleteByIds(db: IDBDatabase, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    let i = 0;
    const step = () => {
      if (i >= ids.length) {
        resolve();
        return;
      }
      const req = os.delete(ids[i]!);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        i += 1;
        step();
      };
    };
    step();
  });
}

async function postSessionEventsBatch(bodies: string[]): Promise<Response> {
  let events: unknown[];
  try {
    events = bodies.map((b) => JSON.parse(b) as unknown);
  } catch {
    return new Response(null, { status: 400 });
  }
  const wrapped = JSON.stringify({ events });
  return URLRegistry.request('telemetrySessionEvents', {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: wrapped
  });
}

async function runFlush(postTelemetry: PostTelemetry): Promise<void> {
  try {
    let db: IDBDatabase;
    try {
      db = await openDb();
    } catch {
      return;
    }
    for (;;) {
      const batch = await readOrderedRecords(db, BATCH_FLUSH_MAX);
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id).filter((id): id is number => typeof id === 'number');
      if (ids.length === 0) break;

      if (batch.length >= 2) {
        try {
          const res = await postSessionEventsBatch(batch.map((r) => r.body));
          if (res.ok) {
            await deleteByIds(db, ids);
            continue;
          }
        } catch {
          // fall through to single-event drain
        }
      }

      const first = batch[0];
      if (!first || first.id == null) break;
      try {
        const res = await postTelemetry(first.body);
        if (!res.ok) break;
        await deleteById(db, first.id);
      } catch {
        break;
      }
    }
  } catch {
    // IndexedDB or network — leave queue intact for a later flush.
  }
}

/**
 * Sends all queued events in primary key order; removes each row after a successful POST.
 * Stops on first failure so unsent items remain for a later flush.
 * Concurrent callers are serialized.
 */
export function flushTelemetryOutbox(postTelemetry: PostTelemetry): Promise<void> {
  flushChain = flushChain.then(() => runFlush(postTelemetry));
  return flushChain;
}
