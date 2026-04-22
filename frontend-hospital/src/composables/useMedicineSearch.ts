import { ref, watch, type Ref } from 'vue';
import { URLRegistry } from '../services/http/URLRegistry';
import { getAuthToken } from '../services/auth/authToken';

export interface MedicineSearchResult {
  id: string;
  name: string;
  composition: string;
  manufacturer: string;
  pack_size?: string;
  price?: number | string;
  is_discontinued?: boolean;
}

export function useMedicineSearch(query: Ref<string>) {
  const results = ref<MedicineSearchResult[]>([]);
  const isLoading = ref(false);
  const error = ref('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    query,
    (next) => {
      const q = String(next ?? '').trim();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (q.length < 2) {
        results.value = [];
        error.value = '';
        isLoading.value = false;
        return;
      }
      debounceTimer = setTimeout(async () => {
        isLoading.value = true;
        error.value = '';
        try {
          const token = getAuthToken();
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;
          const response = await fetch(`${URLRegistry.resolve('medicinesSearch')}?q=${encodeURIComponent(q)}`, {
            method: 'GET',
            // Always send cookies (HttpOnly access_token) even if in-memory token was cleared after reload.
            credentials: 'include',
            headers
          });
          if (!response.ok) {
            // Non-fatal: caller can continue with fallback static suggestions.
            results.value = [];
            error.value = '';
            return;
          }
          const root = (await response.json()) as Record<string, unknown>;
          const listNode = (root.Data ?? root.data ?? root.results ?? root.Results ?? []) as unknown;
          results.value = Array.isArray(listNode) ? (listNode as MedicineSearchResult[]) : [];
        } catch {
          results.value = [];
          error.value = '';
        } finally {
          isLoading.value = false;
        }
      }, 300);
    },
    { immediate: true }
  );

  return { results, isLoading, error };
}
