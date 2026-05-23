import { Client, type IFrame, type IMessage, type StompSubscription } from '@stomp/stompjs';

import { getMobileApiBaseUrl } from '@/api/config';
import { useSessionStore } from '@/auth/sessionStore';

export type SubscriptionHandle = { unsubscribe: () => void };

function getWsUrl(): string | null {
  try {
    const base = getMobileApiBaseUrl();
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

const reconnectDelay = 5000;
let client: Client | null = null;
let connectPromise: Promise<void> | null = null;

export async function stompConnect(): Promise<void> {
  if (client?.connected) return;
  if (connectPromise) return connectPromise;
  if (client?.active && !client.connected) {
    client.deactivate();
    client = null;
  }

  connectPromise = (async () => {
    const connectHeaders: Record<string, string> = {};
    const brokerURL = getWsUrl();
    if (!brokerURL) return;

    const next = new Client({
      brokerURL,
      connectHeaders,
      reconnectDelay,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      debug: () => {},
      beforeConnect: async () => {
        for (const key of Object.keys(connectHeaders)) {
          delete connectHeaders[key];
        }
        const token = useSessionStore.getState().accessToken;
        if (token) connectHeaders.Authorization = `Bearer ${token}`;
      }
    });

    client = next;

    await new Promise<void>((resolve, reject) => {
      next.onConnect = () => resolve();
      next.onStompError = (frame: IFrame) => {
        next.deactivate();
        client = null;
        reject(new Error(frame.headers['message'] || 'STOMP broker error'));
      };
      next.onWebSocketError = () => {
        next.deactivate();
        client = null;
        reject(new Error(`WebSocket failed to ${brokerURL}`));
      };
      next.activate();
    });
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export function stompDisconnect(): void {
  if (!client) return;
  client.deactivate();
  client = null;
}

export function stompSubscribe(
  destination: string,
  onMessage: (message: IMessage) => void
): SubscriptionHandle | null {
  if (!client?.connected) return null;
  const sub: StompSubscription = client.subscribe(destination, onMessage);
  return { unsubscribe: () => sub.unsubscribe() };
}

export function stompPublish(destination: string, body: unknown): boolean {
  if (!client?.connected) return false;
  const serialized = JSON.stringify(body ?? {});
  client.publish({
    destination,
    body: serialized.length > 0 ? serialized : '{}'
  });
  return true;
}
