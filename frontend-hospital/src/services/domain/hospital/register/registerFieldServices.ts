import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';

export const registerFieldHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'set-register-first-name',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-last-name',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-email',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'emailId', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'password', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-address',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'address', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-gender',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'gender', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-mobile',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'mobileNumber', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  }
];
