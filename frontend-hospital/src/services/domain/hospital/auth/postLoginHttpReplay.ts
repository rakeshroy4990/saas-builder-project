import type { AxiosRequestConfig } from 'axios';
import { URLRegistry } from '../../../http/URLRegistry';

const STORAGE_KEY = 'flexshell-pending-http-replay-v1';

export type PendingHttpReplay = {
  method: string;
  url: string;
  params?: Record<string, unknown>;
  data?: unknown;
};

function isAuthHandshakeUrl(url: string): boolean {
  const u = url.toLowerCase();
  const skip = [
    URLRegistry.paths.login,
    URLRegistry.paths.googleLogin,
    URLRegistry.paths.refresh,
    URLRegistry.paths.logout,
    URLRegistry.paths.register
  ];
  return skip.some((p) => u.includes(String(p).toLowerCase()));
}

function cloneSerializableBody(data: unknown): unknown {
  if (data === undefined || data === null) return undefined;
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return undefined;
  }
}

/** Persist last failed API request so it can be retried after login (JSON bodies only). */
export function stashPendingHttpReplay(config: AxiosRequestConfig | undefined): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (!config?.url) return;
    const url = String(config.url);
    if (isAuthHandshakeUrl(url)) return;
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) return;

    const method = String(config.method ?? 'get').toLowerCase();
    const snapshot: PendingHttpReplay = {
      method,
      url,
      params: config.params as Record<string, unknown> | undefined
    };
    const cloned = cloneSerializableBody(config.data);
    if (cloned !== undefined) snapshot.data = cloned;

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

/** Pop and return one stashed replay payload (single-use). */
export function takePendingHttpReplay(): PendingHttpReplay | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as PendingHttpReplay;
    if (!parsed?.method || !parsed?.url) return null;
    return parsed;
  } catch {
    return null;
  }
}
