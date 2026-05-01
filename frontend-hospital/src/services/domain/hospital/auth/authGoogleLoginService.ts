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

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const GIS_SCRIPT_SELECTOR = 'script[data-flexshell-gis="1"]';

/**
 * Minimal scopes work with a Google OAuth client in "Testing" (test users only) or production
 * without sensitive-scope verification. Gender/phone People API scopes require Google verification;
 * enable only with {@code VITE_GOOGLE_OAUTH_EXTENDED_SCOPES=true} after your app is approved.
 */
function getGoogleOAuthScopeString(): string {
  const base = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  const extended =
    String(import.meta.env.VITE_GOOGLE_OAUTH_EXTENDED_SCOPES ?? '')
      .trim()
      .toLowerCase() === 'true';
  if (extended) {
    base.push(
      'https://www.googleapis.com/auth/user.gender.read',
      'https://www.googleapis.com/auth/user.phonenumbers.read'
    );
  }
  return base.join(' ');
}

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in requires a browser.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  const existing = document.querySelector(GIS_SCRIPT_SELECTOR);
  if (existing instanceof HTMLScriptElement) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.flexshellGis = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(s);
  });
}

function requestGoogleAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error('Google Sign-In is not available.'));
      return;
    }
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: getGoogleOAuthScopeString(),
      callback: (resp) => {
        if (resp.error) {
          const detail = resp.error_description ? `${resp.error}: ${resp.error_description}` : resp.error;
          reject(new Error(detail || 'Google sign-in failed'));
          return;
        }
        const token = String(resp.access_token ?? '').trim();
        if (!token) {
          reject(new Error('Google sign-in was cancelled.'));
          return;
        }
        resolve(token);
      }
    });
    client.requestAccessToken();
  });
}

export const authGoogleLoginHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'auth-login-google',
    responseCodes: { failure: ['AUTH_FAILED'] },
    execute: async () => {
      const clientId = String(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '').trim();
      if (!clientId) {
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthForm',
          'authError',
          'Google sign-in is not configured. Set VITE_GOOGLE_OAUTH_CLIENT_ID for this app.'
        );
        return { responseCode: 'AUTH_FAILED', message: 'Google client id missing', suppressPopupInlineError: true };
      }

      let googleAccessToken: string;
      try {
        await loadGoogleIdentityScript();
        googleAccessToken = await requestGoogleAccessToken(clientId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
        if (!/cancel|popup|closed|denied|access_denied/i.test(msg)) {
          trackEvent('login_failed', {
            reason: 'request_failed',
            domain: 'auth',
            status: 'fail',
            reason_code: telemetryReasonCodes.auth.requestFailed,
            trace_id: getOrCreateTraceId()
          });
        }
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', msg);
        return { responseCode: 'AUTH_FAILED', message: msg, suppressPopupInlineError: true };
      }

      try {
        const response = await apiClient.post(URLRegistry.paths.googleLogin, {
          AccessToken: googleAccessToken
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
        const identity =
          pickString(userData, ['Email', 'email']) ||
          pickString(userData, ['UserId', 'userId']) ||
          '';
        await finalizeHospitalLoginSession(userData, identity, { authMethod: 'google' });
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
          const message = pickString(errorPayload, ['Message', 'message']) || 'Google sign-in failed.';
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
          'Unable to complete Google login. Please try again.'
        );
        return {
          responseCode: 'AUTH_FAILED',
          message: 'Unable to complete Google login. Please try again.',
          suppressPopupInlineError: true
        };
      }
    }
  }
];
