import { createStompClient } from '@realtime/createStompClient';
import { getApiBaseUrl } from '../http/URLRegistry';
import { logClient } from '../logging/clientLogger';

export const stompClient = createStompClient({
  getApiBaseUrl,
  onInfo: (msg, data) => logClient('INFO', msg, data),
  onError: (msg, data) => logClient('ERROR', msg, data),
  reconnectDelayMs: 5000
});

