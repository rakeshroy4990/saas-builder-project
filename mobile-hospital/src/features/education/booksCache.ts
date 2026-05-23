import { fetchEducationBooks } from '@/features/education/api';

let cachedBooks: string[] | null = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

export function peekCachedEducationBooks(): string[] | null {
  if (!cachedBooks || Date.now() - cachedAt > TTL_MS) return null;
  return cachedBooks;
}

export async function loadEducationBooksCached(force = false): Promise<string[]> {
  if (!force) {
    const hit = peekCachedEducationBooks();
    if (hit) return hit;
  }
  const list = await fetchEducationBooks();
  cachedBooks = list;
  cachedAt = Date.now();
  return list;
}

export function invalidateEducationBooksCache(): void {
  cachedBooks = null;
  cachedAt = 0;
}
