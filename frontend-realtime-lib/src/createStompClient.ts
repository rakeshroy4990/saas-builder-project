import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';

export type StompClientDeps = {
  getApiBaseUrl: () => string;
  getBearerToken?: () => string | null;
  onInfo?: (msg: string, data?: Record<string, unknown>) => void | Promise<void>;
  onError?: (msg: string, data?: Record<string, unknown>) => void | Promise<void>;
  reconnectDelayMs?: number;
};

export type SubscriptionHandle = { unsubscribe: () => void };

function getWsUrl(getApiBaseUrl: () => string): string {
  const base = getApiBaseUrl();
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function createStompClient(deps: StompClientDeps) {
  const reconnectDelay = deps.reconnectDelayMs ?? 5000;
  let client: Client | null = null;
  let connectPromise: Promise<void> | null = null;

  async function connect(): Promise<void> {
    if (client?.active) return;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
      const connectHeaders: Record<string, string> = {};

      const next = new Client({
        brokerURL: getWsUrl(deps.getApiBaseUrl),
        connectHeaders,
        reconnectDelay,
        heartbeatIncoming: 20000,
        heartbeatOutgoing: 20000,
        debug: () => {},
        beforeConnect: async () => {
          // Ensure we always use the latest token (e.g. after refresh).
          // `@stomp/stompjs` reuses connectHeaders object, so mutate in-place.
          for (const key of Object.keys(connectHeaders)) {
            delete connectHeaders[key];
          }
          const token = deps.getBearerToken?.();
          if (token) connectHeaders.Authorization = `Bearer ${token}`;
        }
      });

      client = next;

      await new Promise<void>((resolve, reject) => {
        next.onConnect = async () => {
          await deps.onInfo?.('STOMP connected');
          resolve();
        };
        next.onStompError = async (frame) => {
          await deps.onError?.('STOMP error', { message: frame.headers['message'], body: frame.body });
          next.deactivate();
          client = null;
          reject(new Error(frame.headers['message'] || 'STOMP broker error'));
        };
        next.onWebSocketError = async () => {
          await deps.onError?.('WebSocket error');
          next.deactivate();
          client = null;
          reject(new Error('WebSocket error'));
        };
        next.activate();
      });
    })().finally(() => {
      connectPromise = null;
    });

    return connectPromise;
  }

  function disconnect(): void {
    if (!client) return;
    client.deactivate();
    client = null;
  }

  function subscribe(destination: string, onMessage: (message: IMessage) => void): SubscriptionHandle {
    if (!client || !client.connected) throw new Error('STOMP client not connected');
    const sub: StompSubscription = client.subscribe(destination, onMessage);
    return { unsubscribe: () => sub.unsubscribe() };
  }

  function publish(destination: string, body: unknown): void {
    if (!client || !client.connected) throw new Error('STOMP client not connected');
    client.publish({ destination, body: JSON.stringify(body ?? {}) });
  }

  return { connect, disconnect, subscribe, publish } as const;
}

