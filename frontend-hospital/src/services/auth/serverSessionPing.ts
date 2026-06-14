import { URLRegistry } from '../http/URLRegistry';
import { getOrCreateTraceId } from '../logging/traceContext';

/** Reuse a recent successful ping while switching dashboard tabs in the same session. */
const SESSION_PING_TTL_MS = 60_000;

type SessionPingCache = {
  userId: string;
  verifiedAtMs: number;
};

let cache: SessionPingCache | null = null;
let inflight: Promise<boolean> | null = null;
let inflightUserId: string | null = null;

export function invalidateServerSessionPingCache(): void {
  cache = null;
  inflight = null;
  inflightUserId = null;
}

export async function pingServerSession(userId: string, options?: { force?: boolean }): Promise<boolean> {
  const normalizedUserId = String(userId ?? '').trim();
  if (!normalizedUserId) {
    return false;
  }

  const now = Date.now();
  const force = options?.force === true;

  if (
    !force &&
    cache?.userId === normalizedUserId &&
    now - cache.verifiedAtMs < SESSION_PING_TTL_MS
  ) {
    return true;
  }

  if (!force && inflight && inflightUserId === normalizedUserId) {
    return inflight;
  }

  inflightUserId = normalizedUserId;
  inflight = (async () => {
    try {
      const url = `${URLRegistry.getBaseUrl()}/api/user?userId=${encodeURIComponent(normalizedUserId)}`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-Trace-Id': getOrCreateTraceId()
        }
      });
      const alive = res.ok;
      if (alive) {
        cache = { userId: normalizedUserId, verifiedAtMs: Date.now() };
      } else {
        cache = null;
      }
      return alive;
    } catch {
      cache = null;
      return false;
    } finally {
      inflight = null;
      inflightUserId = null;
    }
  })();

  return inflight;
}
