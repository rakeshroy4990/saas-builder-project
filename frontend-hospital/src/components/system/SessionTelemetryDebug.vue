<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getOrCreateTraceId } from '../../services/logging/traceContext';
import { URLRegistry } from '../../services/http/URLRegistry';

const loading = ref(true);
const errorText = ref('');
const snapshot = ref<Record<string, unknown> | null>(null);

const traceId = computed(() => getOrCreateTraceId());

const summaryRows = computed(() => {
  const raw = snapshot.value?.sessionSummary;
  return Array.isArray(raw) ? raw : [];
});

function pick(row: unknown, key: string): string {
  if (!row || typeof row !== 'object') return '';
  const r = row as Record<string, unknown>;
  const v = r[key];
  if (v == null) return '';
  if (typeof v === 'object') return '';
  return String(v);
}

function num(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowAttributes(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== 'object') return null;
  const a = (row as Record<string, unknown>).attributes;
  if (a && typeof a === 'object' && !Array.isArray(a)) return a as Record<string, unknown>;
  return null;
}

function jsonObj(o: Record<string, unknown> | null): string {
  if (!o) return '';
  try {
    return JSON.stringify(o);
  } catch {
    return '';
  }
}

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const url = `${URLRegistry.resolve('telemetrySessionSnapshot')}?trace_id=${encodeURIComponent(traceId.value)}`;
    const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    const json = (await res.json()) as { Success?: boolean; Data?: unknown; Message?: string };
    if (!res.ok || json.Success === false) {
      errorText.value = String(json.Message ?? res.statusText ?? 'Request failed');
      snapshot.value = null;
      return;
    }
    snapshot.value = (json.Data ?? null) as Record<string, unknown> | null;
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : 'Failed to load';
    snapshot.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto max-w-5xl p-6 font-sans text-sm text-slate-800">
    <h1 class="mb-2 text-lg font-semibold">Session telemetry (this tab)</h1>
    <p class="mb-4 text-slate-600">
      Trace <code class="rounded bg-slate-100 px-1">{{ traceId }}</code> —
      <button type="button" class="text-blue-600 underline" @click="load">Refresh</button>
    </p>
    <p v-if="loading" class="text-slate-500">Loading…</p>
    <p v-else-if="errorText" class="text-red-600">{{ errorText }}</p>
    <div v-else-if="snapshot" class="space-y-4">
      <dl class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div><dt class="text-slate-500">Session key</dt><dd class="font-mono text-xs">{{ snapshot.sessionKey }}</dd></div>
        <div><dt class="text-slate-500">User</dt><dd class="font-mono text-xs">{{ snapshot.userId }}</dd></div>
        <div><dt class="text-slate-500">Total events</dt><dd>{{ snapshot.totalEvents }}</dd></div>
        <div><dt class="text-slate-500">Updated</dt><dd>{{ snapshot.updatedAt }}</dd></div>
      </dl>
      <div>
        <h2 class="mb-2 font-medium">Session summary (login → logout)</h2>
        <p v-if="summaryRows.length === 0" class="mb-2 text-slate-600">0 records</p>
        <div v-else class="overflow-x-auto rounded border border-slate-200">
          <table class="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-2 py-2">Time</th>
                <th class="px-2 py-2">Kind</th>
                <th class="px-2 py-2">Email</th>
                <th class="px-2 py-2">Page / component / popup</th>
                <th class="px-2 py-2">API / detail</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(row, i) in summaryRows" :key="i">
                <td class="px-2 py-1 align-top font-mono text-[11px] text-slate-600">
                  {{ pick(row, 'occurredAt') }}
                </td>
                <td class="px-2 py-1 align-top">{{ pick(row, 'kind') }}</td>
                <td class="max-w-[14rem] truncate px-2 py-1 align-top text-[11px] text-slate-700" :title="pick(row, 'userEmail')">
                  {{ pick(row, 'userEmail') }}
                </td>
                <td class="px-2 py-1 align-top font-mono text-[11px]">
                  <span v-if="pick(row, 'pageId')">page={{ pick(row, 'pageId') }} </span>
                  <span v-if="pick(row, 'componentId')">btn={{ pick(row, 'componentId') }} </span>
                  <span v-if="pick(row, 'popupPageId')">popup={{ pick(row, 'popupPageId') }}</span>
                </td>
                <td class="max-w-md px-2 py-1 align-top font-mono text-[11px] text-slate-700 break-all">
                  <template v-if="pick(row, 'apiPath')">
                    {{ pick(row, 'httpMethod') }} {{ pick(row, 'apiPath') }}
                    <span v-if="num(pick(row, 'durationMs')) != null"> ({{ num(pick(row, 'durationMs')) }} ms)</span>
                  </template>
                  <span v-else-if="pick(row, 'routePath')">{{ pick(row, 'routePath') }}</span>
                  <span v-else-if="pick(row, 'errorMessage')" class="text-red-700">{{ pick(row, 'errorMessage') }}</span>
                  <span v-else-if="rowAttributes(row)">{{ jsonObj(rowAttributes(row)) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
