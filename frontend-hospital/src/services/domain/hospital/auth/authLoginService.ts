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
import { ensureHospitalAdminSupportInboxReady } from '../chat/chatServices';
import { trackEvent } from '../../../analytics/firebaseAnalytics';

export const authLoginHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'auth-login',
    responseCodes: { failure: ['AUTH_FAILED'] },
    execute: async (request) => {
      const identity = String(request.data.identity ?? '').trim();
      const password = String(request.data.password ?? '').trim();
      if (!identity || !password) {
        trackEvent('login_failed', { reason: 'missing_credentials' });
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', 'Email and password are required.');
        return { responseCode: 'AUTH_FAILED', message: 'Missing credentials', suppressPopupInlineError: true };
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
          return {
            responseCode: 'AUTH_FAILED',
            message: 'Login response missing user data',
            suppressPopupInlineError: true
          };
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
        const resolvedQualifications = pickString(userData, [
          'Qualifications',
          'Qualification',
          'qualifications',
          'qualification'
        ]);
        const resolvedSmcName = pickString(userData, ['SmcName', 'smcName', 'StateMedicalCouncil', 'stateMedicalCouncil']);
        const resolvedSmcRegistrationNumber = pickString(userData, [
          'SmcRegistrationNumber',
          'smcRegistrationNumber',
          'RegistrationNumber',
          'registrationNumber'
        ]);
        const resolvedRole = pickString(userData, ['Role', 'role']).toUpperCase() || 'PATIENT';
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userId', canonicalUserId);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', displayName);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'email', resolvedEmail);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'mobileNumber', resolvedMobileNumber);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'address', resolvedAddress);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'gender', resolvedGender);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'department', resolvedDepartment);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'qualifications', resolvedQualifications);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'smcName', resolvedSmcName);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'smcRegistrationNumber', resolvedSmcRegistrationNumber);
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
          qualifications: resolvedQualifications,
          smcName: resolvedSmcName,
          smcRegistrationNumber: resolvedSmcRegistrationNumber,
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
        if (resolvedRole === 'ADMIN') {
          try {
            await ensureHospitalAdminSupportInboxReady();
          } catch {
            // Non-fatal: badge/chat still work after opening the chat popup.
          }
        }
        trackEvent('login_success', { role: resolvedRole });
        return ok();
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          trackEvent('login_failed', { reason: 'unauthorized' });
          const errorPayload = (error.response?.data ?? {}) as Record<string, unknown>;
          const message =
            pickString(errorPayload, ['Message', 'message']) || 'Invalid email or password';
          useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', message);
          return { responseCode: 'AUTH_FAILED', message, suppressPopupInlineError: true };
        }
        trackEvent('login_failed', { reason: 'request_failed' });
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthForm',
          'authError',
          'Unable to login right now. Please try again.'
        );
        return {
          responseCode: 'AUTH_FAILED',
          message: 'Unable to login right now. Please try again.',
          suppressPopupInlineError: true
        };
      }
    }
  }
];
