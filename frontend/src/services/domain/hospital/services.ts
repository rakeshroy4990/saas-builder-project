import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../store/useAppStore';

const ok = (data: Record<string, unknown> = {}) => ({ responseCode: 'SUCCESS', ...data });

export const hospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'load-doctors',
    execute: async () => {
      useAppStore().setData('hospital', 'Doctors', {
        list: [
          { id: 'doc-1', label: 'Dr. Lee', value: 'doc-1' },
          { id: 'doc-2', label: 'Dr. Kumar', value: 'doc-2' }
        ]
      });
      return ok();
    }
  },
  { packageName: 'hospital', serviceId: 'book-appointment', execute: async () => ok({ appointmentId: 'APT-1001' }) }
];
