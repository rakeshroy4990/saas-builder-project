import { fetchEducationBooks } from '@/features/education/api';

let cachedBooks: string[] | null = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;
const RETRY_BACKOFF_MS = [0, 1500, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function peekCachedEducationBooks(): string[] | null {
  if (!cachedBooks || Date.now() - cachedAt > TTL_MS) return null;
  return cachedBooks;
}

export async function loadEducationBooksCached(force = false): Promise<string[]> {
  if (!force) {
    const hit = peekCachedEducationBooks();
    if (hit) return hit;
  }

  let lastError: unknown = new Error('Failed to load education books');
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_BACKOFF_MS[attempt]);
    }
    try {
      const list = await fetchEducationBooks();
      cachedBooks = list;
      cachedAt = Date.now();
      return list;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function invalidateEducationBooksCache(): void {
  cachedBooks = null;
  cachedAt = 0;
}
