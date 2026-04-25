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
    smcName: pickString(row, ['SmcName', 'smcName', 'StateMedicalCouncil', 'stateMedicalCouncil']),
    smcRegistrationNumber: pickString(row, [
      'SmcRegistrationNumber',
      'smcRegistrationNumber',
      'RegistrationNumber',
      'registrationNumber'
    ]),
    role: pickString(row, ['Role', 'role']),
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
    role: String(sess.role ?? '')
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
        'smcName',
        'smcRegistrationNumber'
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
        useToastStore(pinia).show('Please log in to view your profile.', 'info');
        await router.replace('/hospital/home');
        return ok();
      }
      appStore.setData('hospital', 'ProfilePageUiState', { activeSection: 'profile' });
      appStore.setProperty('hospital', 'ProfileForm', 'saveError', '');
      appStore.setProperty('hospital', 'ProfileForm', 'saving', true);
      try {
        const response = await apiClient.get(URLRegistry.paths.user, { params: { userId: uid } });
        const root = (response.data ?? {}) as Record<string, unknown>;
        const data = (root.Data ?? root.data ?? {}) as Record<string, unknown>;
        mapMeToProfileForm(data);
        syncAuthSessionFromProfile(data);
        return ok();
      } catch (err: unknown) {
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? err.response?.data ?? err.message)
          : 'Could not load profile';
        useToastStore(pinia).show(typeof msg === 'string' ? msg : 'Could not load profile', 'error');
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
        toast.show('Please log in to save your profile.', 'info');
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
        body.SmcName = pickString(form, ['smcName', 'SmcName']);
        body.SmcRegistrationNumber = pickString(form, ['smcRegistrationNumber', 'SmcRegistrationNumber']);
      }
      try {
        const response = await apiClient.put(URLRegistry.paths.userProfile, body, { params: { userId: uid } });
        const root = (response.data ?? {}) as Record<string, unknown>;
        if (root.Success === false || root.success === false) {
          const msg = String(root.Message ?? root.message ?? 'Save failed');
          appStore.setProperty('hospital', 'ProfileForm', 'saveError', msg);
          toast.show(msg, 'error');
          return { responseCode: 'USER_PROFILE_SAVE_FAILED', message: msg };
        }
        const data = (root.Data ?? root.data ?? {}) as Record<string, unknown>;
        mapMeToProfileForm(data);
        syncAuthSessionFromProfile(data);
        toast.show('Profile saved.', 'success');
        return ok();
      } catch (err: unknown) {
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? 'Save failed')
          : 'Save failed';
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
    serviceId: 'deactivate-user-account',
    responseCodes: { failure: ['USER_DEACTIVATE_FAILED'] },
    execute: async () => {
      const toast = useToastStore(pinia);
      const appStore = useAppStore(pinia);
      const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const uid = String(session.userId ?? '').trim();
      if (!uid) {
        toast.show('Please log in first.', 'info');
        return { responseCode: 'USER_DEACTIVATE_FAILED', message: 'Not logged in' };
      }
      try {
        await apiClient.put(URLRegistry.paths.user, null, { params: { userId: uid, inactive: true } });
      } catch (err: unknown) {
        const msg = isAxiosError(err)
          ? String((err.response?.data as Record<string, unknown>)?.Message ?? 'Could not deactivate account')
          : 'Could not deactivate account';
        toast.show(msg, 'error');
        return { responseCode: 'USER_DEACTIVATE_FAILED', message: msg };
      }
      try {
        await apiClient.post(URLRegistry.paths.logout, { DeviceId: 'browser' });
      } catch {
        // ignore
      }
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
      clearPersistedAuthSessionProfile();
      toast.show('Your account has been deactivated.', 'info');
      window.location.assign('/hospital/home');
      return ok();
    }
  }
];
