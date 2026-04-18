import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';

export const authFormHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'set-auth-identity',
    execute: async (request) => {
      const identity = String(request.data.value ?? '');
      const email = identity.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailError =
        email.length === 0 || emailRegex.test(email) ? '' : 'Please enter a valid email address.';
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', identity);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', emailError);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-auth-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      return ok();
    }
  }
];
