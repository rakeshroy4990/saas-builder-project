import type { Composer } from 'vue-i18n';
import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { clearAuthToken } from '../../../auth/authToken';
import { clearPersistedAuthSessionProfile, persistAuthSessionProfile } from '../../../auth/authSessionStore';
import { router } from '../../../../router';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { clearCallHeartbeatTimer, clearWebrtcSubscription } from '../shared/callState';
import { clearChatSubscription, clearSupportSubscription } from '../shared/chatState';
import { buildLogoutRequestBody } from '../../../auth/logoutRequestBody';
import { flushSessionTelemetryQueue } from '../../../analytics/sessionTelemetry';
import {
  emitSessionSummaryAuthLogout,
  flushPendingSessionSummaryNavigate
} from '../../../analytics/sessionSummary';
import { trackEvent } from '../../../analytics/firebaseAnalytics';
import { getOrCreateTraceId } from '../../../logging/traceContext';
import { clearLoginSessionId } from '../../../logging/loginSessionContext';
import { telemetryReasonCodes } from '../../../observability/telemetrySchema';
import { isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import { i18n, setAppLocale } from '../../../../i18n';

const tr = (key: string): string => (i18n.global as Composer).t(key);

function mapMeToProfileForm(row: Record<string, unknown>): void {
  const store = useAppStore(pinia);
  store.setData('hospital', 'ProfileForm', {
    firstName: pickString(row, ['FirstName', 'firstName']),
    lastName: pickString(row, ['LastName', 'lastName']),
    email: pickString(row, ['EmailId', 'emailId', 'Email', 'email']),
    mobileNumber: pickString(row, ['MobileNumber', 'mobileNumber']),
    address: pickString(row, ['Address', 'address']),
    gender: pickString(row, ['Gender', 'gender']),
    department: pickString(row, ['Department', 'department']),
    qualifications: pickString(row, ['Qualifications', 'qualifications', 'Qualification', 'qualification']),
    experienceSummary: pickString(row, ['ExperienceSummary', 'experienceSummary']),
    profilePic: pickString(row, ['ProfilePic', 'profilePic']),
    smcName: pickString(row, ['SmcName', 'smcName', 'StateMedicalCouncil', 'stateMedicalCouncil']),
    smcRegistrationNumber: pickString(row, [
      'SmcRegistrationNumber',
      'smcRegistrationNumber',
      'RegistrationNumber',
      'registrationNumber'
    ]),
    role: pickString(row, ['Role', 'role']),
    preferredLocale: pickString(row, ['PreferredLocale', 'preferredLocale']).trim().toLowerCase(),
    saveError: '',
    saving: false
  });
}

function syncAuthSessionFromProfile(row: Record<string, unknown>): void {
  const store = useAppStore(pinia);
  const fn = pickString(row, ['FirstName', 'firstName']);
  const ln = pickString(row, ['LastName', 'lastName']);
  const full = [fn, ln].filter(Boolean).join(' ').trim();
  const email = pickString(row, ['EmailId', 'emailId', 'Email', 'email']);
  const mobile = pickString(row, ['MobileNumber', 'mobileNumber']);
  const address = pickString(row, ['Address', 'address']);
  const gender = pickString(row, ['Gender', 'gender']);
  const department = pickString(row, ['Department', 'department']);
  const qualifications = pickString(row, ['Qualifications', 'qualifications', 'Qualification', 'qualification']);
  const smcName = pickString(row, ['SmcName', 'smcName', 'StateMedicalCouncil', 'stateMedicalCouncil']);
  const smcRegistrationNumber = pickString(row, [
    'SmcRegistrationNumber',
    'smcRegistrationNumber',
    'RegistrationNumber',
    'registrationNumber'
  ]);
  const userId = pickString(row, ['UserId', 'userId']);
  const preferredLocale = pickString(row, ['PreferredLocale', 'preferredLocale']).trim().toLowerCase();
  store.setProperty('hospital', 'AuthSession', 'email', email);
  store.setProperty('hospital', 'AuthSession', 'mobileNumber', mobile);
  store.setProperty('hospital', 'AuthSession', 'address', address);
  store.setProperty('hospital', 'AuthSession', 'gender', gender);
  store.setProperty('hospital', 'AuthSession', 'department', department);
  store.setProperty('hospital', 'AuthSession', 'qualifications', qualifications);
  store.setProperty('hospital', 'AuthSession', 'smcName', smcName);
  store.setProperty('hospital', 'AuthSession', 'smcRegistrationNumber', smcRegistrationNumber);
  if (full) {
    store.setProperty('hospital', 'AuthSession', 'fullName', full);
    store.setProperty('hospital', 'AuthSession', 'userDisplayName', full);
  }
  store.setProperty('hospital', 'AuthSession', 'preferredLocale', preferredLocale);
  const sess = (store.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  persistAuthSessionProfile({
    userId: userId || String(sess.userId ?? ''),
    userDisplayName: full || String(sess.userDisplayName ?? ''),
    fullName: full || String(sess.fullName ?? ''),
    loginDisplayName: String(sess.loginDisplayName ?? 'Login'),
    email: email || String(sess.email ?? ''),
    mobileNumber: mobile || String(sess.mobileNumber ?? ''),
    address: address || String(sess.address ?? ''),
    gender: gender || String(sess.gender ?? ''),
    department: department || String(sess.department ?? ''),
    qualifications: qualifications || String(sess.qualifications ?? ''),
    smcName: smcName || String(sess.smcName ?? ''),
    smcRegistrationNumber: smcRegistrationNumber || String(sess.smcRegistrationNumber ?? ''),
    role: String(sess.role ?? ''),
    preferredLocale: preferredLocale || String(sess.preferredLocale ?? '')
  });
}

export const profileUserHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'set-profile-page-section',
    execute: async (request) => {
      const section = String(request.data.section ?? 'profile').trim().toLowerCase();
      const next = section === 'inactive' ? 'inactive' : 'profile';
      useAppStore(pinia).setData('hospital', 'ProfilePageUiState', { activeSection: next });
      trackEvent('profile_viewed', {
        section: next,
        domain: 'profile',
        status: 'success',
        reason_code: telemetryReasonCodes.profile.sectionChanged,
        trace_id: getOrCreateTraceId()
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-profile-form-field',
    execute: async (request) => {
      const field = String(request.data.field ?? '').trim();
      const allowed = new Set([
        'firstName',
        'lastName',
        'email',
        'mobileNumber',
        'address',
        'gender',
        'department',
        'qualifications',
        'experienceSummary',
        'profilePic',
        'smcName',
        'smcRegistrationNumber',
        'preferredLocale'
      ]);
      if (!allowed.has(field)) return ok();
      useAppStore(pinia).setProperty('hospital', 'ProfileForm', field, String(request.data.value ?? ''));
      useAppStore(pinia).setProperty('hospital', 'ProfileForm', 'saveError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'init-profile-page',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const uid = String(session.userId ?? '').trim();
      if (!uid) {
        useToastStore(pinia).show(tr('toast.profileViewLoginRequired'), 'info');
        await router.replace('/home');
        return ok();
      }
      const existingProfileUi = (appStore.getData('hospital', 'ProfilePageUiState') ?? {}) as Record<string, unknown>;
      const existingSection = String(existingProfileUi.activeSection ?? '').trim().toLowerCase();
      appStore.setData('hospital', 'ProfilePageUiState', {
        activeSection: existingSection === 'inactive' ? 'inactive' : 'profile'
      });
      appStore.setProperty('hospital', 'ProfileForm', 'saveError', '');
      appStore.setProperty('hospital', 'ProfileForm', 'saving', true);
      try {
        const response = await apiClient.get(URLRegistry.paths.user, { params: { userId: uid } });
        const root = (response.data ?? {}) as Record<string, unknown>;
        const data = (root.Data ?? root.data ?? {}) as Record<string, unknown>;
        mapMeToProfileForm(data);
        syncAuthSessionFromProfile(data);
        const currentUi = (appStore.getData('hospital', 'ProfilePageUiState') ?? {}) as Record<string, unknown>;
        const activeSection = String(currentUi.activeSection ?? 'profile').trim().toLowerCase() === 'inactive' ? 'inactive' : 'profile';
        trackEvent('profile_viewed', {
          section: activeSection,
          domain: 'profile',
          status: 'success',
          reason_code: telemetryReasonCodes.profile.pageLoaded,
          trace_id: getOrCreateTraceId()
        });
        return ok();
      } catch (err: unknown) {
        trackEvent('profile_view_failed', {
          domain: 'profile',
          status: 'fail',
          reason_code: telemetryReasonCodes.profile.pageLoadFailed,
          trace_id: getOrCreateTraceId(),
          http_status: isAxiosError(err) ? err.response?.status : undefined
        });
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? err.response?.data ?? err.message)
          : tr('toast.profileLoadFailed');
        useToastStore(pinia).show(typeof msg === 'string' ? msg : tr('toast.profileLoadFailed'), 'error');
        return ok();
      } finally {
        useAppStore(pinia).setProperty('hospital', 'ProfileForm', 'saving', false);
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'save-user-profile',
    responseCodes: { failure: ['USER_PROFILE_SAVE_FAILED'] },
    execute: async () => {
      const toast = useToastStore(pinia);
      const appStore = useAppStore(pinia);
      const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const uid = String(session.userId ?? '').trim();
      if (!uid) {
        toast.show(tr('toast.profileSaveLoginRequired'), 'info');
        return { responseCode: 'USER_PROFILE_SAVE_FAILED', message: 'Not logged in' };
      }
      const form = (appStore.getData('hospital', 'ProfileForm') ?? {}) as Record<string, unknown>;
      appStore.setProperty('hospital', 'ProfileForm', 'saveError', '');
      appStore.setProperty('hospital', 'ProfileForm', 'saving', true);
      const body: Record<string, string> = {
        EmailId: pickString(form, ['email', 'EmailId', 'Email']),
        FirstName: pickString(form, ['firstName', 'FirstName']),
        LastName: pickString(form, ['lastName', 'LastName']),
        Address: pickString(form, ['address', 'Address']),
        Gender: pickString(form, ['gender', 'Gender']),
        MobileNumber: pickString(form, ['mobileNumber', 'MobileNumber']),
        Department: pickString(form, ['department', 'Department'])
      };
      if (String(session.role ?? '').toUpperCase() === 'DOCTOR') {
        body.Qualifications = pickString(form, ['qualifications', 'Qualifications']);
        body.ExperienceSummary = pickString(form, ['experienceSummary', 'ExperienceSummary']);
        body.ProfilePic = pickString(form, ['profilePic', 'ProfilePic']);
        body.SmcName = pickString(form, ['smcName', 'SmcName']);
        body.SmcRegistrationNumber = pickString(form, ['smcRegistrationNumber', 'SmcRegistrationNumber']);
      }
      const prefLocale = pickString(form, ['preferredLocale', 'PreferredLocale']).trim().toLowerCase();
      if (prefLocale && isSupportedLocale(prefLocale)) {
        body.PreferredLocale = prefLocale;
      }
      try {
        const response = await apiClient.put(URLRegistry.paths.userProfile, body, { params: { userId: uid } });
        const root = (response.data ?? {}) as Record<string, unknown>;
        if (root.Success === false || root.success === false) {
          const msg = String(root.Message ?? root.message ?? tr('toast.profileSaveFailed'));
          appStore.setProperty('hospital', 'ProfileForm', 'saveError', msg);
          toast.show(msg, 'error');
          return { responseCode: 'USER_PROFILE_SAVE_FAILED', message: msg };
        }
        const data = (root.Data ?? root.data ?? {}) as Record<string, unknown>;
        mapMeToProfileForm(data);
        syncAuthSessionFromProfile(data);
        trackEvent('profile_saved', {
          domain: 'profile',
          status: 'success',
          reason_code: telemetryReasonCodes.profile.saveSuccess,
          trace_id: getOrCreateTraceId()
        });
        const plAfter = pickString(data, ['PreferredLocale', 'preferredLocale']).trim().toLowerCase();
        if (plAfter && isSupportedLocale(plAfter)) {
          await setAppLocale(plAfter as LocaleCode);
        }
        toast.show(tr('toast.profileSaved'), 'success');
        return ok();
      } catch (err: unknown) {
        trackEvent('profile_save_failed', {
          domain: 'profile',
          status: 'fail',
          reason_code: telemetryReasonCodes.profile.saveFailed,
          trace_id: getOrCreateTraceId(),
          http_status: isAxiosError(err) ? err.response?.status : undefined
        });
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? tr('toast.profileSaveFailed'))
          : tr('toast.profileSaveFailed');
        appStore.setProperty('hospital', 'ProfileForm', 'saveError', msg);
        toast.show(msg, 'error');
        return { responseCode: 'USER_PROFILE_SAVE_FAILED', message: msg };
      } finally {
        appStore.setProperty('hospital', 'ProfileForm', 'saving', false);
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'save-preferred-locale',
    responseCodes: { failure: ['PREFERRED_LOCALE_SAVE_FAILED'] },
    execute: async (request) => {
      const toast = useToastStore(pinia);
      const appStore = useAppStore(pinia);
      const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const uid = String(session.userId ?? '').trim();
      if (!uid) {
        toast.show(tr('toast.localeLoginRequired'), 'info');
        return { responseCode: 'PREFERRED_LOCALE_SAVE_FAILED', message: 'Not logged in' };
      }
      const code = pickString(request.data, ['locale']).trim().toLowerCase();
      if (!isSupportedLocale(code)) {
        toast.show(tr('toast.localeUnsupported'), 'error');
        return { responseCode: 'PREFERRED_LOCALE_SAVE_FAILED', message: 'Unsupported locale' };
      }
      try {
        const response = await apiClient.put(
          URLRegistry.paths.userProfile,
          { PreferredLocale: code },
          { params: { userId: uid } }
        );
        const root = (response.data ?? {}) as Record<string, unknown>;
        if (root.Success === false || root.success === false) {
          const msg = String(root.Message ?? root.message ?? tr('toast.profileSaveFailed'));
          toast.show(msg, 'error');
          return { responseCode: 'PREFERRED_LOCALE_SAVE_FAILED', message: msg };
        }
        const data = (root.Data ?? root.data ?? {}) as Record<string, unknown>;
        let resolved = pickString(data, ['PreferredLocale', 'preferredLocale']).trim().toLowerCase();
        if (!isSupportedLocale(resolved)) {
          resolved = code;
        }
        appStore.setProperty('hospital', 'AuthSession', 'preferredLocale', resolved);
        persistAuthSessionProfile({ preferredLocale: resolved });
        appStore.setProperty('hospital', 'ProfileForm', 'preferredLocale', resolved);
        await setAppLocale(resolved as LocaleCode);
        trackEvent('profile_saved', {
          domain: 'profile',
          status: 'success',
          reason_code: telemetryReasonCodes.profile.saveSuccess,
          trace_id: getOrCreateTraceId()
        });
        toast.show(tr('toast.languageSaved'), 'success');
        return ok();
      } catch (err: unknown) {
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? tr('toast.profileSaveFailed'))
          : tr('toast.profileSaveFailed');
        toast.show(msg, 'error');
        return { responseCode: 'PREFERRED_LOCALE_SAVE_FAILED', message: msg };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'deactivate-user-account',
    responseCodes: { failure: ['USER_DEACTIVATE_FAILED'] },
    execute: async () => {
      const toast = useToastStore(pinia);
      const appStore = useAppStore(pinia);
      const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const uid = String(session.userId ?? '').trim();
      if (!uid) {
        toast.show(tr('toast.deactivateLoginRequired'), 'info');
        return { responseCode: 'USER_DEACTIVATE_FAILED', message: 'Not logged in' };
      }
      try {
        await apiClient.put(URLRegistry.paths.user, null, { params: { userId: uid, inactive: true } });
      } catch (err: unknown) {
        trackEvent('profile_deactivate_failed', {
          domain: 'profile',
          status: 'fail',
          reason_code: telemetryReasonCodes.profile.deactivateFailed,
          trace_id: getOrCreateTraceId(),
          http_status: isAxiosError(err) ? err.response?.status : undefined
        });
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? tr('toast.deactivateFailed'))
          : tr('toast.deactivateFailed');
        toast.show(msg, 'error');
        return { responseCode: 'USER_DEACTIVATE_FAILED', message: msg };
      }
      try {
        await apiClient.post(URLRegistry.paths.logout, buildLogoutRequestBody());
      } catch {
        // ignore
      }
      await flushPendingSessionSummaryNavigate();
      await emitSessionSummaryAuthLogout({ reason: 'account_deactivated' });
      trackEvent('profile_deactivated', {
        domain: 'profile',
        status: 'success',
        reason_code: telemetryReasonCodes.profile.deactivateSuccess,
        trace_id: getOrCreateTraceId()
      });
      await flushSessionTelemetryQueue();
      clearWebrtcSubscription();
      clearChatSubscription();
      clearSupportSubscription();
      clearCallHeartbeatTimer();
      clearAuthToken();
      appStore.setProperty('hospital', 'AuthSession', 'userId', '');
      appStore.setProperty('hospital', 'AuthSession', 'userDisplayName', '');
      appStore.setProperty('hospital', 'AuthSession', 'email', '');
      appStore.setProperty('hospital', 'AuthSession', 'mobileNumber', '');
      appStore.setProperty('hospital', 'AuthSession', 'address', '');
      appStore.setProperty('hospital', 'AuthSession', 'gender', '');
      appStore.setProperty('hospital', 'AuthSession', 'department', '');
      appStore.setProperty('hospital', 'AuthSession', 'qualifications', '');
      appStore.setProperty('hospital', 'AuthSession', 'smcName', '');
      appStore.setProperty('hospital', 'AuthSession', 'smcRegistrationNumber', '');
      appStore.setProperty('hospital', 'AuthSession', 'fullName', '');
      appStore.setProperty('hospital', 'AuthSession', 'role', '');
      appStore.setProperty('hospital', 'AuthSession', 'loginDisplayName', 'Login');
      appStore.setProperty('hospital', 'AuthSession', 'preferredLocale', '');
      clearPersistedAuthSessionProfile();
      clearLoginSessionId();
      toast.show(tr('toast.accountDeactivated'), 'info');
      window.location.assign('/home');
      return ok();
    }
  }
];
