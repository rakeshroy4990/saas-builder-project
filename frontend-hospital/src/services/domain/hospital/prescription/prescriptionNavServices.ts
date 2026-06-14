import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { isAuthTokenExpired } from '../../../auth/authToken';
import { pingServerSession } from '../../../auth/serverSessionPing';
import { ok } from '../shared/response';

const PRESCRIPTION_GUARD_TABS = new Set(['upload', 'view']);

function openLoginForPrescriptions(): void {
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AuthForm', 'identity', '');
  appStore.setProperty('hospital', 'AuthForm', 'password', '');
  appStore.setProperty('hospital', 'AuthForm', 'emailError', '');
  appStore.setProperty('hospital', 'AuthForm', 'authError', '');
  appStore.setProperty(
    'hospital',
    'AuthForm',
    'loginInfoMessage',
    'Please sign in to manage your prescriptions.'
  );
  usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
}

export const prescriptionNavHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'require-hospital-prescription-session',
    responseCodes: { failure: ['PRESCRIPTION_SESSION_REQUIRED'] },
    execute: async (request) => {
      const tab = String(request.data.tab ?? '').trim().toLowerCase();
      if (!PRESCRIPTION_GUARD_TABS.has(tab)) {
        return {
          responseCode: 'PRESCRIPTION_SESSION_REQUIRED',
          message: 'Invalid prescription tab',
          suppressPopupInlineError: true
        };
      }
      const appStore = useAppStore(pinia);
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const userId = String(authSession.userId ?? '').trim();
      if (!userId) {
        openLoginForPrescriptions();
        return {
          responseCode: 'PRESCRIPTION_SESSION_REQUIRED',
          message: 'Sign in required',
          suppressPopupInlineError: true
        };
      }
      if (isAuthTokenExpired()) {
        openLoginForPrescriptions();
        return {
          responseCode: 'PRESCRIPTION_SESSION_REQUIRED',
          message: 'Session expired',
          suppressPopupInlineError: true
        };
      }
      const alive = await pingServerSession(userId);
      if (!alive) {
        openLoginForPrescriptions();
        return {
          responseCode: 'PRESCRIPTION_SESSION_REQUIRED',
          message: 'Session expired',
          suppressPopupInlineError: true
        };
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'init-prescriptions',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'PrescriptionNav', { activeItem: 'view' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-prescription-nav-upload',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'PrescriptionNav', { activeItem: 'upload' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-prescription-nav-view',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'PrescriptionNav', { activeItem: 'view' });
      return ok();
    }
  }
];
