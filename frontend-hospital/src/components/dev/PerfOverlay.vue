<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { PERF_ENABLED, perfStore, type PerfEntry } from '@/composables/usePerf';

const collapsed = ref(false);

const apiCalls = computed(() =>
  perfStore.value.filter((e) => e.type === 'api').slice(-10).reverse()
);
const components = computed(() =>
  perfStore.value.filter((e) => e.type === 'component').slice(-8).reverse()
);

/** FCP / LCP: milliseconds from navigation start (not “since overlay opened”). */
const fcpMs = ref<number | null>(null);
const lcpMs = ref<number | null>(null);
const lcpDetail = ref<string>('');

const navTtfbMs = ref<number | null>(null);
const navDomContentLoadedMs = ref<number | null>(null);
const navLoadMs = ref<number | null>(null);

const longTasks = ref<{ durationMs: number; atMs: number }[]>([]);

let paintObs: PerformanceObserver | null = null;
let lcpObs: PerformanceObserver | null = null;
let longTaskObs: PerformanceObserver | null = null;

let bestLcpStart = 0;

function lcpEntryLabel(entry: PerformanceEntry & { element?: Element; url?: string }): string {
  const el = entry.element;
  if (el && el instanceof Element) {
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls.length > 1 ? cls.slice(0, 48) : ''}`;
  }
  const u = (entry as { url?: string }).url;
  return u ? `resource ${u.slice(0, 40)}` : '—';
}

function readBufferedPaintAndNav(): void {
  try {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) {
      fcpMs.value = Math.round(fcp.startTime);
    }
  } catch {
    /* ignore */
  }

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0) {
      navTtfbMs.value = Math.round(nav.responseStart - nav.requestStart);
    }
    if (nav && nav.domContentLoadedEventEnd > 0) {
      navDomContentLoadedMs.value = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
    }
    if (nav && nav.loadEventEnd > 0) {
      navLoadMs.value = Math.round(nav.loadEventEnd - nav.startTime);
    }
  } catch {
    /* ignore */
  }
}

function durationClass(ms: number): string {
  if (ms < 200) return 'text-emerald-400';
  if (ms < 1000) return 'text-amber-300';
  return 'text-red-400';
}

onMounted(() => {
  if (!PERF_ENABLED) {
    return;
  }
  readBufferedPaintAndNav();

  try {
    paintObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === 'first-contentful-paint') {
          fcpMs.value = Math.round(e.startTime);
        }
      }
    });
    paintObs.observe({ type: 'paint', buffered: true } as PerformanceObserverInit);
  } catch {
    /* ignore */
  }

  try {
    lcpObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.startTime >= bestLcpStart) {
          bestLcpStart = e.startTime;
          lcpMs.value = Math.round(e.startTime);
          lcpDetail.value = lcpEntryLabel(e as PerformanceEntry & { element?: Element; url?: string });
        }
      }
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true } as PerformanceObserverInit);
  } catch {
    /* ignore */
  }

  try {
    longTaskObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const d = Math.round(e.duration);
        if (d < 50) continue;
        longTasks.value = [{ durationMs: d, atMs: Math.round(e.startTime) }, ...longTasks.value].slice(0, 6);
      }
    });
    longTaskObs.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
  } catch {
    /* ignore */
  }
});

onUnmounted(() => {
  paintObs?.disconnect();
  lcpObs?.disconnect();
  longTaskObs?.disconnect();
});

function formatApi(e: PerfEntry): string {
  return e.label;
}
</script>

<template>
  <div
    v-if="PERF_ENABLED"
    class="pointer-events-auto fixed bottom-3 right-3 z-[9999] max-h-[70vh] w-[min(100vw-1.5rem,28rem)] overflow-hidden rounded-lg border border-white/15 bg-black/80 font-mono text-[11px] text-white shadow-xl backdrop-blur-sm"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between border-b border-white/10 bg-white/5 px-2 py-1.5 text-left font-semibold tracking-wide text-white/90 hover:bg-white/10"
      @click="collapsed = !collapsed"
    >
      <span>PERF</span>
      <span class="text-white/50">{{ collapsed ? '▲' : '▼' }}</span>
    </button>
    <div v-show="!collapsed" class="max-h-[60vh] space-y-2 overflow-y-auto p-2">
      <details class="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/65">
        <summary class="cursor-pointer select-none font-medium text-white/80">Web vitals & UI timing — what is this?</summary>
        <ul class="mt-1.5 list-inside list-disc space-y-1 leading-snug">
          <li>
            <span class="text-white/85">FCP</span> (First Contentful Paint): ms from navigation start until the first
            <strong>text or image</strong> is painted. High values usually mean slow network, big JS, or blocking work before first paint.
          </li>
          <li>
            <span class="text-white/85">LCP</span> (Largest Contentful Paint): ms until the <strong>largest visible</strong> text or
            image block was painted — a Core Web Vital. The line below tries to name the DOM node when the browser exposes it.
          </li>
          <li>
            <span class="text-white/85">Nav</span>: classic page milestones from the Navigation Timing API (full initial load only;
            SPA client navigations often do not reset these).
          </li>
          <li>
            <span class="text-white/85">Long tasks</span>: main-thread slices ≥50ms (jank). Many short tasks feel faster than one
            long task of the same total time.
          </li>
          <li>
            <span class="text-white/85">Components</span>: only routes/widgets that call
            <code class="rounded bg-black/40 px-0.5">useComponentPerf('Name')</code> in
            <code class="rounded bg-black/40 px-0.5">script setup</code> — measures from
            <code class="rounded bg-black/40 px-0.5">onBeforeMount</code> through layout after mount (see composable).
          </li>
        </ul>
      </details>

      <div>
        <div class="mb-1 text-[10px] uppercase text-white/50">Web vitals (from navigation start)</div>
        <div class="text-white/80">
          FCP {{ fcpMs != null ? `${fcpMs}ms` : '—' }} · LCP {{ lcpMs != null ? `${lcpMs}ms` : '—' }}
        </div>
        <div v-if="lcpDetail" class="mt-0.5 truncate text-[10px] text-white/55" :title="lcpDetail">LCP target: {{ lcpDetail }}</div>
      </div>

      <div v-if="navTtfbMs != null || navDomContentLoadedMs != null || navLoadMs != null">
        <div class="mb-1 text-[10px] uppercase text-white/50">Navigation (initial document)</div>
        <div class="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/75">
          <span v-if="navTtfbMs != null">TTFB {{ navTtfbMs }}ms</span>
          <span v-if="navDomContentLoadedMs != null">DCL {{ navDomContentLoadedMs }}ms</span>
          <span v-if="navLoadMs != null">Load {{ navLoadMs }}ms</span>
        </div>
      </div>

      <div v-if="longTasks.length">
        <div class="mb-1 text-[10px] uppercase text-white/50">Long tasks (main thread, ≥50ms)</div>
        <ul class="space-y-0.5 text-[10px]">
          <li v-for="(t, i) in longTasks" :key="`lt-${t.atMs}-${i}`" class="flex justify-between gap-2 text-white/70">
            <span>@ {{ t.atMs }}ms nav</span>
            <span :class="durationClass(t.durationMs)">{{ t.durationMs }}ms</span>
          </li>
        </ul>
      </div>

      <div>
        <div class="mb-1 text-[10px] uppercase text-white/50">API (last 10)</div>
        <ul class="space-y-0.5">
          <li v-for="(e, i) in apiCalls" :key="`api-${e.timestamp}-${i}`" class="flex justify-between gap-2">
            <span class="min-w-0 flex-1 truncate text-white/70" :title="e.label">{{ formatApi(e) }}</span>
            <span :class="durationClass(e.durationMs)">{{ Math.round(e.durationMs) }}ms</span>
          </li>
          <li v-if="!apiCalls.length" class="text-white/40">—</li>
        </ul>
      </div>
      <div>
        <div class="mb-1 text-[10px] uppercase text-white/50">Components (useComponentPerf; last 8)</div>
        <ul class="space-y-0.5">
          <li v-for="(e, i) in components" :key="`cmp-${e.timestamp}-${i}`" class="flex justify-between gap-2">
            <span class="truncate text-white/70">{{ e.label }}</span>
            <span :class="durationClass(e.durationMs)">{{ Math.round(e.durationMs) }}ms</span>
          </li>
          <li v-if="!components.length" class="text-white/40">—</li>
        </ul>
      </div>
    </div>
  </div>
</template>
