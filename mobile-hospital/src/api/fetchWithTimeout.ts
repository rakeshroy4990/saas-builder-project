import { DEFAULT_API_TIMEOUT_MS } from '@/api/timeouts';

/**
 * `fetch` with an explicit timeout (avoids indefinite hangs on Cloud Run cold start).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const userSignal = init.signal;
  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      userSignal.addEventListener('abort', onUserAbort);
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (userSignal) {
      userSignal.removeEventListener('abort', onUserAbort);
    }
  }
}
