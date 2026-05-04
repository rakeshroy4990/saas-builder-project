import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { clearAuthToken } from '../../../auth/authToken';
import { buildLogoutRequestBody } from '../../../auth/logoutRequestBody';
import { clearPersistedAuthSessionProfile } from '../../../auth/authSessionStore';
import { clearLoginSessionId } from '../../../logging/loginSessionContext';
import { ok } from '../shared/response';
import { stompClient } from '../../../realtime/stompClient';
import { clearCallHeartbeatTimer, clearWebrtcSubscription } from '../shared/callState';
import { trackEvent } from '../../../analytics/firebaseAnalytics';
import { flushSessionTelemetryQueue } from '../../../analytics/sessionTelemetry';
import {
  flushPendingSessionSummaryNavigate,
  ingestUserInitiatedLogoutSessionTelemetry
} from '../../../analytics/sessionSummary';

export const logoutUserHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'logout-user',
    execute: async () => {
      await flushPendingSessionSummaryNavigate();
      trackEvent('logout', undefined, { skipSessionTelemetry: true });
      await ingestUserInitiatedLogoutSessionTelemetry({ reason: 'user_initiated' });
      await Promise.all([
        apiClient.post(URLRegistry.paths.logout, buildLogoutRequestBody()).catch(() => undefined)
      ]);
      flushSessionTelemetryQueue();
      stompClient.disconnect();
      clearWebrtcSubscription();
      clearCallHeartbeatTimer();
      clearAuthToken();
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userId', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'email', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'mobileNumber', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'address', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'gender', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'department', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'qualifications', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'smcName', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'smcRegistrationNumber', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'fullName', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'role', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'loginDisplayName', 'Login');
      // Clear user-scoped hero media so home never shows prior session's YouTube video after logout.
      const currentHome = (useAppStore(pinia).getData('hospital', 'HomeContent') ?? {}) as Record<string, unknown>;
      const currentHero =
        currentHome.hero && typeof currentHome.hero === 'object'
          ? (currentHome.hero as Record<string, unknown>)
          : {};
      useAppStore(pinia).setData('hospital', 'HomeContent', {
        ...currentHome,
        hero: { ...currentHero, videoId: null, videoKind: null }
      });
      // Remove last Smart AI conversation from Pinia to prevent stale query reuse after logout.
      const currentChat = (useAppStore(pinia).getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      useAppStore(pinia).setData('hospital', 'Chat', {
        ...currentChat,
        activeRoomId: '',
        aiProcessing: false,
        messagesByRoomId: {}
      });
      clearPersistedAuthSessionProfile();
      clearLoginSessionId();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'emailId', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'address', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'gender', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'mobileNumber', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'role', 'PATIENT');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'department', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'qualifications', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'smcName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'smcRegistrationNumber', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'acceptTerms', false);
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      usePopupStore(pinia).close();
      if (window.location.pathname !== '/home') {
        window.location.assign('/home');
      }
      return ok();
    }
  }
];
