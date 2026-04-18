import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';

export const registerSuccessHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-register-success-popup',
    execute: async () => {
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'register-success-popup',
        title: 'registration-success'
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'ack-register-success',
    execute: async () => {
      const registerForm = (useAppStore(pinia).getData('hospital', 'RegisterForm') ?? {}) as Record<
        string,
        unknown
      >;
      const email = String(registerForm.emailId ?? '').trim();
      usePopupStore(pinia).close();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', email);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
      return ok();
    }
  }
];
