import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';

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
      if (!firstName || !lastName || !emailId || !password || !address || !gender || !mobileNumber) {
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', 'All fields are required.');
        return { responseCode: 'REGISTER_FAILED', message: 'Missing registration details' };
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
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? String(error.response?.data?.message ?? '').trim()
          : '';
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerError',
          message || 'Unable to register right now. Please try again.'
        );
        return { responseCode: 'REGISTER_FAILED', message: message || 'Registration failed' };
      }
    }
  }
];
