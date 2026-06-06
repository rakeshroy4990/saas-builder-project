import { parseNotificationWsEvent } from '@saas-builder/hospital-api-client';

import { stompSubscribe, type SubscriptionHandle } from '@/realtime/stompClient';

import { fetchUnreadCount } from './notificationApi';
import { useNotificationStore } from './notificationStore';

let notificationSubscription: SubscriptionHandle | null = null;

export async function subscribeNotifications(): Promise<void> {
  if (notificationSubscription) return;

  notificationSubscription = stompSubscribe('/user/queue/notifications', (message) => {
    try {
      const payload = JSON.parse(String(message.body ?? '{}')) as unknown;
      const item = parseNotificationWsEvent(payload);
      if (!item) return;
      const row = payload as Record<string, unknown>;
      const unreadFromPush = Number(row.unreadCount ?? row.UnreadCount);
      if (Number.isFinite(unreadFromPush)) {
        useNotificationStore.getState().setUnreadCount(unreadFromPush);
      } else if (!item.isRead) {
        useNotificationStore.getState().setUnreadCount(useNotificationStore.getState().unreadCount + 1);
      }
      useNotificationStore.getState().upsertItem(item);
    } catch {
      // Ignore malformed websocket payloads.
    }
  });
}

export async function hydrateNotifications(): Promise<void> {
  const store = useNotificationStore.getState();
  store.setLoading(true);
  try {
    const count = await fetchUnreadCount();
    store.setUnreadCount(count);
  } catch {
    store.setUnreadCount(0);
  } finally {
    store.setLoading(false);
  }
}

export function unsubscribeNotifications(): void {
  notificationSubscription?.unsubscribe();
  notificationSubscription = null;
  useNotificationStore.getState().reset();
}
