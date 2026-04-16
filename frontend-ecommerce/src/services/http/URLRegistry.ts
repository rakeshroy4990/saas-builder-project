import { getOrCreateTraceId } from '../logging/traceContext';

/**
 * Single entry for Spring API base URL, path constants, and low-level HTTP to the server.
 * Do not call `fetch()` against the API elsewhere—use {@link URLRegistry.request} or axios
 * {@link apiClient} with {@link URLRegistry.paths}.
 */

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_SPRING_API_BASE_URL ?? 'http://localhost:8080';
  return String(raw).replace(/\/$/, '');
}

export const SERVER_PATHS = {
  products: '/api/products',
  /** Persist / load UI metadata (MongoDB {@code uiMetdata} collection on server). */
  uiMetadata: '/api/uiMetdata',
  logsBatch: '/api/logs/batch',
  logsLevel: '/api/logs/level',
  chatRooms: '/api/chat/rooms',
  chatDirectRoom: '/api/chat/rooms/direct',
  test: '/api/test'
} as const;

export type ServerPathKey = keyof typeof SERVER_PATHS;

export const URLRegistry = {
  paths: SERVER_PATHS,
  getBaseUrl: getApiBaseUrl,

  resolve(pathKey: ServerPathKey): string {
    return `${getApiBaseUrl()}${SERVER_PATHS[pathKey]}`;
  },

  /**
   * All direct `fetch` calls to this backend must go through here.
   */
  request(pathKey: ServerPathKey, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers ?? {});
    if (!headers.has('X-Trace-Id')) {
      headers.set('X-Trace-Id', getOrCreateTraceId());
    }
    return fetch(URLRegistry.resolve(pathKey), { ...init, headers });
  }
} as const;
