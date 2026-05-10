import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import type { Composer } from 'vue-i18n';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { i18n } from '../../../../i18n';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { trackEvent } from '../../../analytics/firebaseAnalytics';

type RegisterFieldKey =
  | 'firstName'
  | 'emailId'
  | 'password'
  | 'gender'
  | 'mobileNumber'
  | 'qualifications'
  | 'smcName'
  | 'smcRegistrationNumber';

function registerComposer(): Composer {
  return i18n.global as Composer;
}

function formatMissingRegisterFields(keys: RegisterFieldKey[]): string {
  const c = registerComposer();
  const sep = c.t('register.validation.separator');
  const labels = keys.map((k) => c.t(`register.fields.${k}`));
  return c.t('register.validation.missingFields', { fields: labels.join(sep) });
}

export const registerUserHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'register-user',
    responseCodes: { failure: ['REGISTER_FAILED'] },
    execute: async (request) => {
      const firstName = String(request.data.firstName ?? '').trim();
      const lastName = String(request.data.lastName ?? '').trim();
      const emailId = String(request.data.emailId ?? '').trim();
      const password = String(request.data.password ?? '').trim();
      const address = String(request.data.address ?? '').trim();
      const gender = String(request.data.gender ?? '').trim();
      const mobileNumber = String(request.data.mobileNumber ?? '').trim();
      const department = String(request.data.department ?? '').trim();
      const role = String(request.data.role ?? 'PATIENT').trim().toUpperCase() || 'PATIENT';
      const qualifications = String(request.data.qualifications ?? '').trim();
      const smcName = String(request.data.smcName ?? '').trim();
      const smcRegistrationNumber = String(request.data.smcRegistrationNumber ?? '').trim();
      const acceptTerms = Boolean(request.data.acceptTerms);
      if (!acceptTerms) {
        trackEvent('register_failed', { reason: 'terms_not_accepted' });
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerError',
          registerComposer().t('register.validation.mustAcceptTerms')
        );
        return { responseCode: 'REGISTER_FAILED', message: 'Terms not accepted' };
      }
      const missing: RegisterFieldKey[] = [];
      if (!firstName) missing.push('firstName');
      if (!emailId) missing.push('emailId');
      if (!password) missing.push('password');
      if (!gender) missing.push('gender');
      if (!mobileNumber) missing.push('mobileNumber');
      if (missing.length > 0) {
        trackEvent('register_failed', { reason: 'missing_required_fields' });
        const msg = formatMissingRegisterFields(missing);
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', msg);
        return { responseCode: 'REGISTER_FAILED', message: msg };
      }
      if (role === 'DOCTOR') {
        const doctorMissing: RegisterFieldKey[] = [];
        if (!qualifications) doctorMissing.push('qualifications');
        if (!smcName) doctorMissing.push('smcName');
        if (!smcRegistrationNumber) doctorMissing.push('smcRegistrationNumber');
        if (doctorMissing.length > 0) {
          trackEvent('register_failed', { reason: 'missing_doctor_fields' });
          const msg = formatMissingRegisterFields(doctorMissing);
          useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', msg);
          return { responseCode: 'REGISTER_FAILED', message: msg };
        }
      }

      try {
        const response = await apiClient.post(URLRegistry.paths.register, {
          FirstName: firstName,
          LastName: lastName,
          EmailId: emailId,
          Password: password,
          Address: address,
          Gender: gender,
          MobileNumber: mobileNumber,
          Department: department,
          Qualifications: qualifications,
          SmcName: smcName,
          SmcRegistrationNumber: smcRegistrationNumber,
          Role: role
        });
        if (response.status !== 201 && response.status !== 200) {
          useAppStore(pinia).setProperty(
            'hospital',
            'RegisterForm',
            'registerError',
            'Unable to register right now. Please try again.'
          );
          return { responseCode: 'REGISTER_FAILED', message: 'Registration failed' };
        }
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', firstName);
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', lastName);
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
        const registerData = (response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const roleStatus = pickString(registerData, ['RoleStatus', 'roleStatus']);
        const requestedRole = pickString(registerData, ['RequestedRole', 'requestedRole']) || role;
        const successMessage =
          roleStatus === 'PENDING_APPROVAL'
            ? `${requestedRole} access request submitted for approval by an admin.`
            : 'Registration successful. You can now log in.';
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerSuccessMessage',
          successMessage
        );
        trackEvent('register_success', { role, roleStatus: roleStatus || 'APPROVED' });
        return ok();
      } catch (error) {
        const payload = isAxiosError(error)
          ? ((error.response?.data ?? {}) as Record<string, unknown>)
          : {};
        const message = pickString(payload, ['Message', 'message', 'error', 'ErrorMessage']).trim();
        const errorCode = pickString(payload, ['ErrorCode', 'errorCode']).trim();
        const fallbackMsg = registerComposer().t('register.validation.tryLater');
        const shown =
          !message || errorCode === 'AUTH_INTERNAL_ERROR' ? fallbackMsg : message;
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', shown);
        trackEvent('register_failed', { reason: 'request_failed' });
        return { responseCode: 'REGISTER_FAILED', message: shown };
      }
    }
  }
];
