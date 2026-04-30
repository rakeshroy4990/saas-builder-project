import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { router } from '../../../../router/index';
import { ok } from '../shared/response';
import { ensureMedicalDepartmentOptionsLoaded } from '../shared/medicalDepartments';
import { consumeDeferredPostLoginAction } from '../auth/postLoginAction';
import { ServiceRegistry } from '../../../../core/registry/ServiceRegistry';

function resolveHeaderMenuOpenState(responsive: Record<string, unknown>): boolean {
  return responsive.headerMenuOpen !== false;
}

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
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'HOME', profileMenuOpen: false });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', {
        ...responsive,
        headerMenuOpen: resolveHeaderMenuOpenState(responsive)
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-profile-header-active',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'PROFILE', profileMenuOpen: false });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', {
        ...responsive,
        headerMenuOpen: resolveHeaderMenuOpenState(responsive)
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-header-active',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'DASHBOARD', profileMenuOpen: false });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', {
        ...responsive,
        headerMenuOpen: resolveHeaderMenuOpenState(responsive)
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-education-header-active',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'EDUCATION', profileMenuOpen: false });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', {
        ...responsive,
        headerMenuOpen: resolveHeaderMenuOpenState(responsive)
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-header-active-menu',
    execute: async (request) => {
      const menu = String(request.data.menu ?? '').trim().toUpperCase() || 'HOME';
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: menu, profileMenuOpen: false });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', {
        ...responsive,
        headerMenuOpen: resolveHeaderMenuOpenState(responsive)
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-profile-header-menu',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const header = (appStore.getData('hospital', 'HeaderUiState') ?? {}) as Record<string, unknown>;
      const next = !Boolean(header.profileMenuOpen);
      appStore.setData('hospital', 'HeaderUiState', { ...header, profileMenuOpen: next });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'close-profile-header-menu',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const header = (appStore.getData('hospital', 'HeaderUiState') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'HeaderUiState', { ...header, profileMenuOpen: false });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-header-menu',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const responsive = (appStore.getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
      const currentOpen = responsive.headerMenuOpen !== false;
      const next = !currentOpen;
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
    serviceId: 'open-reset-password-popup',
    execute: async () => {
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'reset-password-popup',
        title: 'reset-password',
        initKey: String(Date.now())
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-hospital-terms-new-tab',
    execute: async () => {
      const href = router.resolve({ path: '/terms' }).href;
      const url = new URL(href, window.location.origin).href;
      window.open(url, '_blank', 'noopener,noreferrer');
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
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'qualifications', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'smcName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'smcRegistrationNumber', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'acceptTerms', false);
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'registerSuccessMessage',
        'Registration successful. You can now log in.'
      );
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      await ensureMedicalDepartmentOptionsLoaded({ force: true });
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
  },
  {
    packageName: 'hospital',
    serviceId: 'execute-post-login-action',
    execute: async () => {
      const deferredAction = consumeDeferredPostLoginAction();
      if (!deferredAction) {
        return ok({ resumed: false });
      }
      const deferredService = ServiceRegistry.getInstance().get(
        deferredAction.packageName,
        deferredAction.actionId
      );
      if (!deferredService) {
        return ok({ resumed: false });
      }
      try {
        await deferredService.execute({ data: deferredAction.data ?? {} });
        return ok({ resumed: true });
      } catch {
        return ok({ resumed: false });
      }
    }
  }
];
