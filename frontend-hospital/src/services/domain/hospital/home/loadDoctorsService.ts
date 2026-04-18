import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';

export const loadDoctorsHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'load-doctors',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'Doctors', {
        list: [
          { id: 'doc-1', label: 'Dr. Sarah Mitchell', value: 'doc-1' },
          { id: 'doc-2', label: 'Dr. James Patterson', value: 'doc-2' },
          { id: 'doc-3', label: 'Dr. Emily Chen', value: 'doc-3' }
        ]
      });
      useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
      useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', { byDepartment: {} });
      return ok();
    }
  }
];
