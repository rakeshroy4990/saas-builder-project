<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DynBluetoothDevices from '@bluetooth/vue/components/DynBluetoothDevices.vue';
import type { BluetoothReading } from '@bluetooth/bluetooth/types';
import type { PageConfig } from '../../core/types/PageConfig';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { useActionEngine } from '../../composables/useActionEngine';
import { useToastStore } from '../../store/useToastStore';
import { savePatientDeviceReading } from '../../services/http/patientDeviceReadingApi';
import { saveGrowthRecord } from '../../services/http/growthApi';

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const appStore = useAppStore(pinia);
const toastStore = useToastStore(pinia);
const { execute } = useActionEngine(props.pageConfig);

const authSession = computed(
  () => (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>
);
const patientId = computed(() => String(authSession.value.userId ?? '').trim());

const selectedChildId = computed(() => {
  void appStore.dataRevision;
  const growthSession = (appStore.getData('hospital', 'GrowthSession') ?? {}) as Record<string, unknown>;
  return String(growthSession.selectedChildId ?? '').trim();
});

const historyReadings = computed(() => {
  const node = (appStore.getData('hospital', 'PatientDeviceReadings') ?? {}) as {
    list?: BluetoothReading[];
  };
  return Array.isArray(node.list) ? node.list : [];
});

async function onReading(reading: BluetoothReading): Promise<void> {
  const childId = selectedChildId.value;
  try {
    if (reading.deviceType === 'scale') {
      const weight = reading.measurements.weight_kg;
      if (childId && weight != null && Number.isFinite(weight)) {
        await saveGrowthRecord({
          childProfileExternalId: childId,
          weightKg: weight,
          source: 'ble_scale'
        });
        toastStore.show('Weight saved to growth chart', 'success');
        await execute({ actionId: 'refresh-growth-chart' });
      } else if (!childId) {
        toastStore.show('Select a child in the Growth tab first', 'warning');
      }
    }

    await savePatientDeviceReading({
      deviceKey: reading.deviceKey,
      deviceName: reading.deviceName,
      deviceType: reading.deviceType,
      measurements: reading.measurements,
      recordedAt: reading.timestamp,
      rawBytes: reading.rawBytes,
      childProfileExternalId: childId || undefined
    });
    await execute({ actionId: 'init-patient-device-readings' });
  } catch {
    // Error surfaced via API client / toast if configured
  }
}

function onStatusChange(status: string): void {
  appStore.setProperty('hospital', 'BluetoothDeviceUiState', 'status', status);
}

function onTypeSelect(type: string | null): void {
  appStore.setProperty('hospital', 'BluetoothDeviceUiState', 'selectedType', type ?? '');
}

function onDeviceKeySelect(key: string | null): void {
  appStore.setProperty('hospital', 'BluetoothDeviceUiState', 'selectedDeviceKey', key ?? '');
}

onMounted(() => {
  void execute({ actionId: 'init-patient-device-readings' });
});
</script>

<template>
  <div :id="htmlId" class="w-full">
    <DynBluetoothDevices
      :patient-id="patientId || undefined"
      :history-readings="historyReadings"
      :on-reading="onReading"
      @status-change="onStatusChange"
      @type-select="onTypeSelect"
      @device-key-select="onDeviceKeySelect"
    />
  </div>
</template>
