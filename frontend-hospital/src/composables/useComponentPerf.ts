import { nextTick, onBeforeMount, onMounted } from 'vue';
import { recordPerf, PERF_ENABLED } from '@/composables/usePerf';

/**
 * Records approximate time for this component view to reach the first frame after mount
 * (beforeMount → nextTick → double rAF). Use at top of `script setup` on heavy pages.
 *
 * This is **not** the same as FCP/LCP (those are browser paint metrics from navigation start).
 */
export function useComponentPerf(componentName: string): void {
  if (!PERF_ENABLED) {
    return;
  }
  let t0 = 0;
  onBeforeMount(() => {
    t0 = performance.now();
  });
  onMounted(() => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          recordPerf({
            label: componentName,
            type: 'component',
            durationMs: performance.now() - t0,
            timestamp: Date.now()
          });
        });
      });
    });
  });
}
