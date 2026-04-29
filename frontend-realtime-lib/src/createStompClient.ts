import { Client, type IFrame, type IMessage, type StompSubscription } from '@stomp/stompjs';

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
    // `active=true` only means activation/reconnect loop is running, not that we can publish.
    // Callers need a hard guarantee that `connect()` resolves only when publish/subscribe are safe.
    if (client?.connected) return;
    if (connectPromise) return connectPromise;
    if (client?.active && !client.connected) {
      client.deactivate();
      client = null;
    }

    connectPromise = (async () => {
      const connectHeaders: Record<string, string> = {};
      const brokerURL = getWsUrl(deps.getApiBaseUrl);

      const next = new Client({
        brokerURL,
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
        next.onStompError = async (frame: IFrame) => {
          console.error('[STOMP] broker error frame', {
            message: frame.headers['message'],
            body: frame.body?.slice?.(0, 500)
          });
          await deps.onError?.('STOMP error', { message: frame.headers['message'], body: frame.body });
          next.deactivate();
          client = null;
          reject(new Error(frame.headers['message'] || 'STOMP broker error'));
        };
        next.onWebSocketError = async (evt: Event) => {
          const hint =
            'Check: (1) Spring backend is running on the same host/port as VITE_SPRING_API_BASE_URL; ' +
            '(2) from another device, use your PC LAN IP in .env, not localhost; ' +
            '(3) firewall allows that port.';
          console.error('[STOMP] WebSocket error', { brokerURL, hint, evt });
          await deps.onError?.('WebSocket error', { brokerURL, hint });
          next.deactivate();
          client = null;
          reject(new Error(`WebSocket failed to ${brokerURL}. ${hint}`));
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
    if (!client || !client.connected) {
      console.error('[STOMP] subscribe while disconnected', { destination });
      throw new Error('STOMP client not connected');
    }
    const sub: StompSubscription = client.subscribe(destination, onMessage);
    return { unsubscribe: () => sub.unsubscribe() };
  }

  function publish(destination: string, body: unknown): void {
    if (!client || !client.connected) {
      console.error('[STOMP] publish while disconnected', { destination, body });
      throw new Error('STOMP client not connected');
    }
    const raw = body ?? {};
    const serialized = JSON.stringify(raw);
    client.publish({
      destination,
      body: typeof serialized === 'string' && serialized.length > 0 ? serialized : '{}'
    });
  }

  return { connect, disconnect, subscribe, publish } as const;
}

