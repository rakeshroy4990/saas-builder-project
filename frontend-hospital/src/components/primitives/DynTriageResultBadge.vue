<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '../../store/useAppStore';

const props = defineProps<{
  appointmentId?: string;
  triageExternalId?: string;
}>();

const appStore = useAppStore();

const triage = computed(() => {
  const map = (appStore.getData('hospital', 'AppointmentTriageMap') ?? {}) as Record<string, Record<string, unknown>>;
  const key = String(props.appointmentId ?? props.triageExternalId ?? '').trim();
  const row = key ? map[key] : null;
  if (!row) return null;
  return {
    childDisplayName: String(row.childDisplayName ?? ''),
    urgencyLevel: String(row.urgencyLevel ?? ''),
    doctorNote: String(row.doctorNote ?? ''),
    redFlags: Array.isArray(row.redFlags) ? (row.redFlags as string[]) : [],
    createdAt: String(row.createdAt ?? '')
  };
});

const expanded = computed({
  get: () => Boolean((appStore.getData('hospital', 'TriageBadgeExpanded') ?? {})[props.appointmentId ?? '']),
  set(value: boolean) {
    const prev = (appStore.getData('hospital', 'TriageBadgeExpanded') ?? {}) as Record<string, boolean>;
    appStore.setData('hospital', 'TriageBadgeExpanded', { ...prev, [props.appointmentId ?? '']: value });
  }
});

const minutesAgo = computed(() => {
  if (!triage.value?.createdAt) return '';
  const diff = Date.now() - new Date(triage.value.createdAt).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  return `Triaged ${mins} min ago`;
});

const badgeClass = computed(() => {
  const level = (triage.value?.urgencyLevel ?? '').toUpperCase();
  if (level === 'EMERGENCY') return 'bg-red-100 text-red-800';
  if (level === 'CLINIC_VISIT') return 'bg-amber-100 text-amber-900';
  if (level === 'HOME_CARE') return 'bg-emerald-100 text-emerald-900';
  return 'bg-gray-100 text-gray-700';
});
</script>

<template>
  <div v-if="triage" class="rounded border border-gray-200 bg-white p-3 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <span :class="['rounded px-2 py-0.5 text-xs font-semibold uppercase', badgeClass]">
        {{ triage.urgencyLevel.replace('_', ' ') }}
      </span>
      <span v-if="triage.childDisplayName" class="font-medium text-gray-800">{{ triage.childDisplayName }}</span>
      <span class="text-xs text-gray-500">{{ minutesAgo }}</span>
      <button class="ml-auto text-xs text-teal-700 underline" type="button" @click="expanded = !expanded">
        {{ expanded ? 'Hide note' : 'View note' }}
      </button>
    </div>
    <div v-if="triage.redFlags.length" class="mt-2 flex flex-wrap gap-1">
      <span
        v-for="flag in triage.redFlags"
        :key="flag"
        class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
      >
        {{ flag }}
      </span>
    </div>
    <p v-if="expanded" class="mt-2 whitespace-pre-wrap text-gray-700">{{ triage.doctorNote }}</p>
  </div>
</template>
