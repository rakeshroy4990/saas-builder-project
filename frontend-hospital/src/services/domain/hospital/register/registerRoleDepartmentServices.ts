import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import { ensureMedicalDepartmentOptionsLoaded } from '../shared/medicalDepartments';

export const registerRoleDepartmentHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'set-register-role',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'role',
        String(request.data.value ?? 'PATIENT')
      );
      const role = String(request.data.value ?? 'PATIENT').toUpperCase();
      if (role !== 'DOCTOR') {
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'department', '');
      } else {
        await ensureMedicalDepartmentOptionsLoaded({ force: true });
      }
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-department',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'department',
        String(request.data.value ?? '')
      );
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  }
];
