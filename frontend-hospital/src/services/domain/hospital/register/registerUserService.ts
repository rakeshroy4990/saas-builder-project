import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { trackEvent } from '../../../analytics/firebaseAnalytics';

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
          'You must accept the Terms & Conditions to register.'
        );
        return { responseCode: 'REGISTER_FAILED', message: 'Terms not accepted' };
      }
      if (!firstName || !lastName || !emailId || !password || !address || !gender || !mobileNumber) {
        trackEvent('register_failed', { reason: 'missing_required_fields' });
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', 'All fields are required.');
        return { responseCode: 'REGISTER_FAILED', message: 'Missing registration details' };
      }
      if (role === 'DOCTOR' && (!qualifications || !smcName || !smcRegistrationNumber)) {
        trackEvent('register_failed', { reason: 'missing_doctor_fields' });
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerError',
          'Qualifications, State Medical Council, and SMC registration number are required for Doctor role.'
        );
        return { responseCode: 'REGISTER_FAILED', message: 'Missing doctor registration details' };
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
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message', 'error']).trim()
          : '';
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerError',
          message || 'Unable to register right now. Please try again.'
        );
        trackEvent('register_failed', { reason: 'request_failed' });
        return { responseCode: 'REGISTER_FAILED', message: message || 'Registration failed' };
      }
    }
  }
];
