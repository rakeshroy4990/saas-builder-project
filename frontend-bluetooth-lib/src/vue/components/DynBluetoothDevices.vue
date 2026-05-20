<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  DEVICE_TYPES,
  DEVICE_TYPE_ICONS,
  DEVICE_TYPE_LABELS,
  devicesForType,
  type DeviceType
} from '../../bluetooth/deviceRegistry';
import type { BluetoothReading } from '../../bluetooth/types';
import { useBluetoothDevice } from '../useBluetoothDevice';
import BluetoothUnsupportedBanner from './BluetoothUnsupportedBanner.vue';
import BluetoothReadingDisplay from './BluetoothReadingDisplay.vue';

const props = withDefaults(
  defineProps<{
    onReading?: (reading: BluetoothReading) => void;
    historyReadings?: BluetoothReading[];
    patientId?: string;
    appointmentId?: string;
  }>(),
  {
    historyReadings: () => []
  }
);

const emit = defineEmits<{
  statusChange: [status: string];
  typeSelect: [type: DeviceType | null];
  deviceKeySelect: [key: string | null];
}>();

const selectedType = ref<DeviceType | null>(null);
const selectedDeviceKey = ref<string | null>(null);

const bluetooth = useBluetoothDevice({
  patientId: props.patientId,
  appointmentId: props.appointmentId,
  autoSubscribe: true,
  onReading: (reading) => {
    props.onReading?.(reading);
  }
});

const selectedProfile = computed(() => {
  if (!selectedDeviceKey.value) return null;
  const list = devicesForType(selectedType.value!);
  return list.find((d) => d.key === selectedDeviceKey.value)?.profile ?? null;
});

const showTypeList = computed(
  () => bluetooth.isSupported && selectedType.value === null && !bluetooth.isConnected.value
);
const showModelList = computed(
  () =>
    bluetooth.isSupported &&
    selectedType.value !== null &&
    selectedDeviceKey.value === null &&
    !bluetooth.isConnected.value
);
const showConnectPanel = computed(
  () => bluetooth.isSupported && selectedDeviceKey.value !== null
);

function selectType(type: DeviceType) {
  selectedType.value = type;
  selectedDeviceKey.value = null;
  emit('typeSelect', type);
  emit('deviceKeySelect', null);
}

function selectDevice(key: string) {
  selectedDeviceKey.value = key;
  emit('deviceKeySelect', key);
}

function backToTypes() {
  if (bluetooth.isConnected.value) return;
  selectedType.value = null;
  selectedDeviceKey.value = null;
  emit('typeSelect', null);
  emit('deviceKeySelect', null);
}

function backToModels() {
  if (bluetooth.isConnected.value) return;
  selectedDeviceKey.value = null;
  emit('deviceKeySelect', null);
}

async function onConnectClick() {
  if (!selectedDeviceKey.value) return;
  await bluetooth.connect(selectedDeviceKey.value);
}

async function onDisconnectClick() {
  await bluetooth.disconnect();
  selectedDeviceKey.value = null;
  selectedType.value = null;
  bluetooth.reset();
  emit('typeSelect', null);
  emit('deviceKeySelect', null);
}

watch(
  () => bluetooth.status.value,
  (s) => emit('statusChange', s)
);

onUnmounted(() => {
  if (bluetooth.session.value) {
    void bluetooth.disconnect();
  }
});
</script>

<template>
  <div class="flex flex-col gap-4 w-full" data-testid="bluetooth-devices">
    <BluetoothUnsupportedBanner v-if="!bluetooth.isSupported" />

    <template v-else>
      <div v-if="showTypeList" class="space-y-3">
        <h2 class="text-lg font-semibold text-slate-900">Choose device type</h2>
        <p class="text-sm text-slate-600">
          Select the type of medical device you want to connect via Bluetooth.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            v-for="type in DEVICE_TYPES"
            :key="type"
            type="button"
            class="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
            :data-testid="`device-type-${type}`"
            @click="selectType(type)"
          >
            <span class="text-2xl mr-2" aria-hidden="true">{{ DEVICE_TYPE_ICONS[type] }}</span>
            <span class="font-semibold text-slate-900">{{ DEVICE_TYPE_LABELS[type] }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="showModelList" class="space-y-3">
        <button
          type="button"
          class="text-sm text-emerald-700 hover:underline"
          @click="backToTypes"
        >
          ← Back to device types
        </button>
        <h2 class="text-lg font-semibold text-slate-900">
          {{ DEVICE_TYPE_LABELS[selectedType!] }} models
        </h2>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="{ key, profile } in devicesForType(selectedType!)"
            :key="key"
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-emerald-300 hover:bg-emerald-50/50"
            :data-testid="`device-model-${key}`"
            @click="selectDevice(key)"
          >
            <span class="mr-2" aria-hidden="true">{{ profile.icon }}</span>
            <span class="font-medium text-slate-900">{{ profile.label }}</span>
            <span class="block text-xs text-slate-500 mt-0.5">{{ profile.unit }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="showConnectPanel" class="space-y-4">
        <button
          v-if="!bluetooth.isConnected.value"
          type="button"
          class="text-sm text-emerald-700 hover:underline"
          @click="backToModels"
        >
          ← Back to models
        </button>

        <div v-if="selectedProfile" class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p class="font-semibold text-slate-900">
            <span aria-hidden="true">{{ selectedProfile.icon }}</span>
            {{ selectedProfile.label }}
          </p>
          <p class="text-sm text-slate-700">{{ selectedProfile.requiresUserAction }}</p>
          <p class="text-xs text-slate-500">Unit: {{ selectedProfile.unit }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="!bluetooth.isConnected.value"
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            :disabled="bluetooth.status.value === 'connecting'"
            data-testid="bluetooth-connect"
            @click="onConnectClick"
          >
            {{ bluetooth.status.value === 'connecting' ? 'Connecting…' : 'Connect device' }}
          </button>
          <template v-else>
            <button
              type="button"
              class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              @click="bluetooth.read()"
            >
              Take reading
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
              data-testid="bluetooth-disconnect"
              @click="onDisconnectClick"
            >
              Disconnect
            </button>
          </template>
        </div>

        <p v-if="bluetooth.error.value" class="text-sm text-red-700" role="alert">
          {{ bluetooth.error.value }}
        </p>

        <p
          v-if="bluetooth.isConnected.value"
          class="text-sm text-emerald-800 font-medium"
        >
          Connected — live readings appear below.
        </p>

        <BluetoothReadingDisplay
          v-if="bluetooth.latestReading.value"
          :reading="bluetooth.latestReading.value"
        />

        <div v-if="bluetooth.readings.value.length > 1" class="space-y-2">
          <h3 class="text-sm font-semibold text-slate-700">Session history</h3>
          <BluetoothReadingDisplay
            v-for="(r, i) in bluetooth.readings.value.slice(1, 6)"
            :key="`${r.timestamp}-${i}`"
            :reading="r"
            compact
          />
        </div>
      </div>

      <div
        v-if="props.historyReadings.length > 0"
        class="space-y-2 border-t border-slate-200 pt-4 mt-2"
      >
        <h3 class="text-sm font-semibold text-slate-700">Saved readings</h3>
        <BluetoothReadingDisplay
          v-for="(r, i) in props.historyReadings.slice(0, 10)"
          :key="`saved-${r.timestamp}-${i}`"
          :reading="r"
          compact
        />
      </div>
    </template>
  </div>
</template>
