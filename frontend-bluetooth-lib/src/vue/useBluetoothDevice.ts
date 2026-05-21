import { ref, onUnmounted, type Ref } from 'vue';
import { BluetoothTimeoutError } from '../bluetooth/bluetoothTimeout';
import {
  connectDevice,
  disconnectDevice,
  readMeasurement,
  subscribeToNotifications
} from '../bluetooth/bluetoothService';
import { isWebBluetoothSupported, getBluetoothUnsupportedReason } from '../bluetooth/bluetoothSupport';
import type { BluetoothReading, BluetoothSession, BluetoothStatus } from '../bluetooth/types';

export interface UseBluetoothDeviceOptions {
  appointmentId?: string;
  patientId?: string;
  onReading?: (reading: BluetoothReading) => void;
  autoSubscribe?: boolean;
}

export interface UseBluetoothDeviceReturn {
  status: Ref<BluetoothStatus>;
  session: Ref<BluetoothSession | null>;
  latestReading: Ref<BluetoothReading | null>;
  readings: Ref<BluetoothReading[]>;
  error: Ref<string | null>;
  isSupported: boolean;
  isConnected: Ref<boolean>;
  connect: (deviceKey: string) => Promise<void>;
  read: () => Promise<BluetoothReading | undefined>;
  disconnect: () => Promise<void>;
  reset: () => void;
}

export function useBluetoothDevice(options: UseBluetoothDeviceOptions = {}): UseBluetoothDeviceReturn {
  const status = ref<BluetoothStatus>(isWebBluetoothSupported() ? 'idle' : 'unsupported');
  const session = ref<BluetoothSession | null>(null);
  const latestReading = ref<BluetoothReading | null>(null);
  const readings = ref<BluetoothReading[]>([]);
  const error = ref<string | null>(null);
  const isConnected = ref(false);
  let unsubscribe: (() => void) | null = null;

  const context = () => ({
    appointmentId: options.appointmentId,
    patientId: options.patientId
  });

  async function connect(deviceKey: string): Promise<void> {
    if (!isWebBluetoothSupported()) {
      status.value = 'unsupported';
      error.value = getBluetoothUnsupportedReason();
      return;
    }

    status.value = 'connecting';
    error.value = null;

    try {
      const newSession = await connectDevice(deviceKey);
      session.value = newSession;
      status.value = 'connected';
      isConnected.value = true;

      if (options.autoSubscribe) {
        unsubscribe = await subscribeToNotifications(
          newSession,
          (reading) => {
            latestReading.value = reading;
            readings.value = [reading, ...readings.value].slice(0, 50);
            options.onReading?.(reading);
          },
          context()
        );
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'NotFoundError') {
        status.value = 'idle';
        isConnected.value = false;
      } else {
        status.value = 'error';
        error.value =
          err instanceof BluetoothTimeoutError
            ? err.message
            : (e.message ?? 'Failed to connect to device');
        isConnected.value = false;
      }
      await disconnectDevice();
    }
  }

  async function read(): Promise<BluetoothReading | undefined> {
    if (!session.value) return;
    status.value = 'reading';
    try {
      const reading = await readMeasurement(session.value, context());
      latestReading.value = reading;
      readings.value = [reading, ...readings.value].slice(0, 50);
      options.onReading?.(reading);
      status.value = 'connected';
      return reading;
    } catch (err: unknown) {
      const e = err as { message?: string };
      status.value = 'error';
      error.value = e.message ?? 'Failed to read from device';
    }
  }

  async function disconnectFn(): Promise<void> {
    unsubscribe?.();
    unsubscribe = null;
    await disconnectDevice();
    session.value = null;
    status.value = 'disconnected';
    isConnected.value = false;
  }

  function reset(): void {
    status.value = isWebBluetoothSupported() ? 'idle' : 'unsupported';
    error.value = null;
    latestReading.value = null;
    readings.value = [];
  }

  onUnmounted(() => {
    if (session.value) {
      void disconnectFn();
    }
  });

  return {
    status,
    session,
    latestReading,
    readings,
    error,
    isSupported: isWebBluetoothSupported(),
    isConnected,
    connect,
    read,
    disconnect: disconnectFn,
    reset
  };
}
