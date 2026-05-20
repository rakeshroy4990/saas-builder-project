import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import {
  dtoToBluetoothReading,
  listPatientDeviceReadings
} from '../../../http/patientDeviceReadingApi';

export const deviceReadingHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-patient-device-readings',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(auth.role ?? '')
        .trim()
        .toUpperCase();
      if (role !== 'PATIENT') {
        appStore.setData('hospital', 'PatientDeviceReadings', { list: [], loadError: '' });
        return ok();
      }
      try {
        const dtos = await listPatientDeviceReadings(0, 20);
        const list = dtos.map(dtoToBluetoothReading);
        appStore.setData('hospital', 'PatientDeviceReadings', { list: list, loadError: '' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load device readings';
        appStore.setData('hospital', 'PatientDeviceReadings', { list: [], loadError: message });
      }
      return ok();
    }
  }
];
