import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { finalizeHospitalLoginSession } from './finalizeHospitalLoginSession';
import { trackEvent } from '../../../analytics/firebaseAnalytics';
import { getOrCreateTraceId } from '../../../logging/traceContext';
import { telemetryReasonCodes } from '../../../observability/telemetrySchema';

export const authLoginHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'auth-login',
    responseCodes: { failure: ['AUTH_FAILED'] },
    execute: async (request) => {
      const identity = String(request.data.identity ?? '').trim();
      const password = String(request.data.password ?? '').trim();
      if (!identity || !password) {
        trackEvent('login_failed', {
          reason: 'missing_credentials',
          domain: 'auth',
          status: 'fail',
          reason_code: telemetryReasonCodes.auth.missingCredentials,
          trace_id: getOrCreateTraceId()
        });
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', 'Email and password are required.');
        return { responseCode: 'AUTH_FAILED', message: 'Missing credentials', suppressPopupInlineError: true };
      }

      try {
        const response = await apiClient.post(URLRegistry.paths.login, {
          EmailId: identity,
          Password: password
        });
        const raw = response.data as Record<string, unknown> | undefined;
        const userData = (raw?.data ?? raw?.Data ?? {}) as Record<string, unknown>;
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
        await finalizeHospitalLoginSession(userData, identity, { authMethod: 'password' });
        return ok();
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          trackEvent('login_failed', {
            reason: 'unauthorized',
            domain: 'auth',
            status: 'fail',
            reason_code: telemetryReasonCodes.auth.unauthorized,
            http_status: error.response?.status,
            trace_id: getOrCreateTraceId()
          });
          const errorPayload = (error.response?.data ?? {}) as Record<string, unknown>;
          const message =
            pickString(errorPayload, ['Message', 'message']) || 'Invalid email or password';
          useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', message);
          return { responseCode: 'AUTH_FAILED', message, suppressPopupInlineError: true };
        }
        trackEvent('login_failed', {
          reason: 'request_failed',
          domain: 'auth',
          status: 'fail',
          reason_code: telemetryReasonCodes.auth.requestFailed,
          http_status: isAxiosError(error) ? error.response?.status : undefined,
          trace_id: getOrCreateTraceId()
        });
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
