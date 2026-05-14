import { ref } from 'vue';

export const PERF_ENABLED = import.meta.env.VITE_PERF_ENABLED === 'true';

export interface PerfEntry {
  label: string;
  type: 'api' | 'component' | 'paint';
  durationMs: number;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export const perfStore = ref<PerfEntry[]>([]);

export function recordPerf(entry: PerfEntry): void {
  if (!PERF_ENABLED) {
    return;
  }
  console.debug('[PERF]', entry);
  perfStore.value = [...perfStore.value, entry].slice(-80);
}

export function usePerf() {
  function record(entry: PerfEntry): void {
    recordPerf(entry);
  }

  function timeApiCall<T>(label: string, promise: Promise<T>): Promise<T> {
    if (!PERF_ENABLED) {
      return promise;
    }
    const start = performance.now();
    return promise.finally(() => {
      recordPerf({
        label,
        type: 'api',
        durationMs: performance.now() - start,
        timestamp: Date.now()
      });
    });
  }

  return { record, timeApiCall };
}
