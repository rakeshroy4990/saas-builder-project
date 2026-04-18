import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { parseJwtSubject, setAuthTokens } from '../../../auth/authToken';
import { persistAuthSessionProfile } from '../../../auth/authSessionStore';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { buildFriendlyDisplayName } from '../shared/displayName';
import { ensureHospitalWebRtcInboundConnected } from '../shared/hospitalWebRtcInbound';

export const authLoginHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'auth-login',
    responseCodes: { failure: ['AUTH_FAILED'] },
    execute: async (request) => {
      const identity = String(request.data.identity ?? '').trim();
      const password = String(request.data.password ?? '').trim();
      if (!identity || !password) {
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', 'Email and password are required.');
        return { responseCode: 'AUTH_FAILED', message: 'Missing credentials' };
      }

      try {
        const response = await apiClient.post(URLRegistry.paths.login, {
          EmailId: identity,
          Password: password
        });
        const userData = (response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        if (!userData || Object.keys(userData).length === 0) {
          useAppStore(pinia).setProperty(
            'hospital',
            'AuthForm',
            'authError',
            'Unexpected login response. Please try again.'
          );
          return { responseCode: 'AUTH_FAILED', message: 'Login response missing user data' };
        }
        const displayName = buildFriendlyDisplayName(userData, identity);
        const accessToken =
          pickString(userData, ['accessToken', 'AccessToken', 'token', 'Token']) || '';
        const refreshToken = pickString(userData, ['refreshToken', 'RefreshToken']) || '';
        if (accessToken && refreshToken) {
          setAuthTokens(accessToken, refreshToken);
        }
        const canonicalUserId =
          parseJwtSubject(accessToken) || pickString(userData, ['UserId', 'userId']) || identity;
        const firstName = pickString(userData, ['FirstName', 'firstName']);
        const lastName = pickString(userData, ['LastName', 'lastName']);
        const fullNameFromNames = [firstName, lastName].filter(Boolean).join(' ').trim();
        const fullName = fullNameFromNames || displayName;
        const resolvedEmail = pickString(userData, ['Email', 'email']) || identity;
        const resolvedMobileNumber = pickString(userData, ['MobileNumber', 'mobileNumber']);
        const resolvedAddress = pickString(userData, ['Address', 'address']);
        const resolvedGender = pickString(userData, ['Gender', 'gender']);
        const resolvedDepartment = pickString(userData, ['Department', 'department']);
        const resolvedRole = pickString(userData, ['Role', 'role']).toUpperCase() || 'PATIENT';
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userId', canonicalUserId);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', displayName);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'email', resolvedEmail);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'mobileNumber', resolvedMobileNumber);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'address', resolvedAddress);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'gender', resolvedGender);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'department', resolvedDepartment);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'fullName', fullName);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'role', resolvedRole);
        persistAuthSessionProfile({
          userId: canonicalUserId,
          userDisplayName: displayName,
          fullName,
          loginDisplayName: displayName,
          email: resolvedEmail,
          mobileNumber: resolvedMobileNumber,
          address: resolvedAddress,
          gender: resolvedGender,
          department: resolvedDepartment,
          role: resolvedRole
        });
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
        try {
          await ensureHospitalWebRtcInboundConnected();
        } catch {
          // Non-fatal: inbound video signals still work after opening dashboard / video popup.
        }
        return ok();
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          const errorPayload = (error.response?.data ?? {}) as Record<string, unknown>;
          const message =
            pickString(errorPayload, ['message', 'Message']) || 'Invalid email or password';
          useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', message);
          return { responseCode: 'AUTH_FAILED', message };
        }
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthForm',
          'authError',
          'Unable to login right now. Please try again.'
        );
        return { responseCode: 'AUTH_FAILED', message: 'Unable to login right now. Please try again.' };
      }
    }
  }
];
