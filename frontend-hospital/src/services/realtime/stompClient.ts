import { createStompClient } from '@realtime/createStompClient';
import { getApiBaseUrl } from '../http/URLRegistry';
import { getAuthToken, isAuthTokenExpired, subscribeAuthToken } from '../auth/authToken';
import { logClient } from '../logging/clientLogger';

export const stompClient = createStompClient({
  getApiBaseUrl,
  getBearerToken: () => {
    const token = getAuthToken();
    if (!token) return null;
    if (isAuthTokenExpired()) return null;
    return token;
  },
  onInfo: (msg, data) => logClient('INFO', msg, data),
  onError: (msg, data) => logClient('ERROR', msg, data),
  reconnectDelayMs: 5000
});

// If the access token expires or is cleared, immediately stop STOMP reconnect loops.
subscribeAuthToken(({ accessToken, expiresAtMs }) => {
  if (!accessToken) {
    stompClient.disconnect();
    return;
  }
  if (expiresAtMs && Date.now() >= expiresAtMs) {
    stompClient.disconnect();
  }
});

