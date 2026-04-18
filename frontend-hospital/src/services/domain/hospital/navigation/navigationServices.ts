import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';

export const navigationHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-login-popup',
    execute: async (request) => {
      const preferredIdentity = String(request.data.identity ?? '').trim();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', preferredIdentity);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-login-popup-after-register',
    execute: async (request) => {
      const preferredIdentity = String(request.data.identity ?? '').trim();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', preferredIdentity);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty(
        'hospital',
        'AuthForm',
        'loginInfoMessage',
        'You have successfully registered. Please login to continue.'
      );
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-home-header-active',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'HOME' });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', { ...responsive, headerMenuOpen: false });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-header-active',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'DASHBOARD' });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', { ...responsive, headerMenuOpen: false });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-header-active-menu',
    execute: async (request) => {
      const menu = String(request.data.menu ?? '').trim().toUpperCase() || 'HOME';
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: menu });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', { ...responsive, headerMenuOpen: false });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-header-menu',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const responsive = (appStore.getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
      const next = !Boolean(responsive.headerMenuOpen);
      appStore.setData('hospital', 'ResponsiveUiState', { ...responsive, headerMenuOpen: next });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-dashboard-filters',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const responsive = (appStore.getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
      const next = !Boolean(responsive.dashboardFiltersOpen);
      appStore.setData('hospital', 'ResponsiveUiState', { ...responsive, dashboardFiltersOpen: next });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-register-popup',
    execute: async () => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'emailId', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'address', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'gender', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'mobileNumber', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'role', 'PATIENT');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'department', '');
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'registerSuccessMessage',
        'Registration successful. You can now log in.'
      );
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'register-popup', title: 'register' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-nav-appointments',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'DashboardNav', { activeItem: 'appointments' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-nav-working-slots',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'DashboardNav', { activeItem: 'working-slots' });
      return ok();
    }
  }
];
