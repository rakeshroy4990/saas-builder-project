import type { NotificationItem } from '@saas-builder/hospital-api-client';
import {
  parseNotificationItem,
  parseNotificationPage,
  parseNotificationWsEvent,
  parseUnreadNotificationCount
} from '@saas-builder/hospital-api-client';
import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { stompClient } from '../../../realtime/stompClient';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { resolveNotificationAction } from '../../../../configs/hospital/notification-config';
import {
  clearNotificationPollTimer,
  clearNotificationSubscription,
  getNotificationPollTimer,
  getNotificationSubscription,
  setNotificationPollTimer,
  setNotificationSubscription
} from './notificationState';

type NotificationsState = {
  items?: NotificationItem[];
  unreadCount?: number;
  panelOpen?: boolean;
  isLoading?: boolean;
};

function readNotificationsState(appStore = useAppStore(pinia)): NotificationsState {
  return (appStore.getData('hospital', 'Notifications') ?? {}) as NotificationsState;
}

function writeNotificationsState(patch: Partial<NotificationsState>): void {
  const appStore = useAppStore(pinia);
  appStore.setData('hospital', 'Notifications', {
    ...readNotificationsState(appStore),
    ...patch
  });
}

async function fetchUnreadCount(): Promise<number> {
  const response = await apiClient.get(URLRegistry.paths.notificationsUnreadCount);
  return parseUnreadNotificationCount(response.data);
}

async function fetchNotificationItems(): Promise<NotificationItem[]> {
  const response = await apiClient.get(URLRegistry.paths.notifications, {
    params: { page: 0, size: 20, sort: 'createdAt,desc' }
  });
  return parseNotificationPage(response.data);
}

function upsertNotificationItem(item: NotificationItem): void {
  const current = readNotificationsState();
  const items = Array.isArray(current.items) ? [...current.items] : [];
  const index = items.findIndex((entry) => entry.externalId === item.externalId);
  if (index >= 0) {
    items[index] = { ...items[index], ...item };
  } else {
    items.unshift(item);
  }
  writeNotificationsState({
    items: items.slice(0, 50),
    unreadCount: items.filter((entry) => !entry.isRead).length
  });
}

function createNotificationQueueHandler() {
  return (message: { body?: string }) => {
    try {
      const payload = JSON.parse(String(message.body ?? '{}')) as unknown;
      const item = parseNotificationWsEvent(payload);
      if (!item) return;
      const payloadRow = payload as Record<string, unknown>;
      const unreadFromPush = Number(payloadRow.unreadCount ?? payloadRow.UnreadCount);
      if (Number.isFinite(unreadFromPush)) {
        writeNotificationsState({ unreadCount: unreadFromPush });
      } else if (!item.isRead) {
        const current = readNotificationsState();
        writeNotificationsState({ unreadCount: (current.unreadCount ?? 0) + 1 });
      }
      upsertNotificationItem(item);
    } catch {
      // Ignore malformed websocket payloads.
    }
  };
}

function subscribeNotificationQueueIfNeeded(): void {
  if (getNotificationSubscription()) return;
  setNotificationSubscription(
    stompClient.subscribe('/user/queue/notifications', createNotificationQueueHandler())
  );
}

function startNotificationPolling(): void {
  if (getNotificationPollTimer()) return;
  const timer = setInterval(() => {
    void fetchUnreadCount()
      .then((count) => writeNotificationsState({ unreadCount: count }))
      .catch(() => {
        // no-op
      });
  }, 30000);
  setNotificationPollTimer(timer);
}

export async function ensureHospitalNotificationsReady(): Promise<void> {
  const appStore = useAppStore(pinia);
  const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  if (!String(session.userId ?? '').trim()) return;

  try {
    const [count, items] = await Promise.all([fetchUnreadCount(), fetchNotificationItems()]);
    writeNotificationsState({ unreadCount: count, items });
  } catch {
    writeNotificationsState({ unreadCount: 0, items: [] });
  }

  let wsConnected = false;
  try {
    await stompClient.connect();
    wsConnected = true;
  } catch {
    wsConnected = false;
  }

  if (getNotificationSubscription()) {
    clearNotificationSubscription();
  }

  if (wsConnected) {
    try {
      subscribeNotificationQueueIfNeeded();
    } catch {
      // Subscriptions require an active STOMP session.
    }
  } else {
    startNotificationPolling();
  }
}

export function teardownHospitalNotifications(): void {
  clearNotificationSubscription();
  clearNotificationPollTimer();
  writeNotificationsState({ items: [], unreadCount: 0, panelOpen: false, isLoading: false });
}

export const notificationHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-notifications',
    execute: async () => {
      await ensureHospitalNotificationsReady();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'load-notifications',
    execute: async () => {
      writeNotificationsState({ isLoading: true });
      try {
        const items = await fetchNotificationItems();
        const unreadCount = items.filter((entry) => !entry.isRead).length;
        writeNotificationsState({ items, unreadCount, isLoading: false });
      } catch {
        writeNotificationsState({ isLoading: false });
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-notification-panel',
    execute: async () => {
      const current = readNotificationsState();
      const nextOpen = !current.panelOpen;
      writeNotificationsState({ panelOpen: nextOpen });
      if (nextOpen) {
        const items = await fetchNotificationItems().catch(() => []);
        const unreadCount = items.filter((entry) => !entry.isRead).length;
        writeNotificationsState({ items, unreadCount, isLoading: false });
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'close-notification-panel',
    execute: async () => {
      writeNotificationsState({ panelOpen: false });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'mark-notification-read',
    execute: async (request) => {
      const notificationId = String(request.data?.notificationId ?? request.data?.externalId ?? '').trim();
      if (!notificationId) return { responseCode: 'NOTIFICATION_READ_FAILED', message: 'Missing notification id' };

      const current = readNotificationsState();
      const items = Array.isArray(current.items) ? [...current.items] : [];
      const target = items.find((entry) => entry.externalId === notificationId);
      if (target && !target.isRead) {
        target.isRead = true;
        writeNotificationsState({
          items,
          unreadCount: Math.max(0, (current.unreadCount ?? 0) - 1)
        });
      }

      try {
        await apiClient.patch(`${URLRegistry.paths.notifications}/${encodeURIComponent(notificationId)}/read`);
      } catch {
        // Optimistic update already applied in UI.
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'mark-all-notifications-read',
    execute: async () => {
      const current = readNotificationsState();
      const items = Array.isArray(current.items)
        ? current.items.map((entry) => ({ ...entry, isRead: true }))
        : [];
      writeNotificationsState({ items, unreadCount: 0 });
      try {
        await apiClient.patch(URLRegistry.paths.notificationsReadAll);
      } catch {
        // no-op
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'navigate-from-notification',
    execute: async (request) => {
      const raw = (request.data?.notification ?? request.data ?? {}) as Record<string, unknown>;
      const notification =
        parseNotificationItem(raw) ??
        ({
          externalId: pickString(raw, ['ExternalId', 'externalId']),
          eventType: pickString(raw, ['EventType', 'eventType']),
          title: pickString(raw, ['Title', 'title']),
          message: pickString(raw, ['Message', 'message']),
          entityType: pickString(raw, ['EntityType', 'entityType']) || null,
          entityExternalId: pickString(raw, ['EntityExternalId', 'entityExternalId']) || null,
          entityRefId: pickString(raw, ['EntityRefId', 'entityRefId']) || null,
          isRead: raw.IsRead === true || raw.isRead === true,
          createdAt: pickString(raw, ['CreatedAt', 'createdAt'])
        } as NotificationItem);

      if (notification.externalId && !notification.isRead) {
        await notificationHospitalServices
          .find((service) => service.serviceId === 'mark-notification-read')
          ?.execute({ data: { notificationId: notification.externalId } });
      }

      writeNotificationsState({ panelOpen: false });

      const mapping = resolveNotificationAction(notification.eventType);
      if (!mapping) {
        return ok();
      }

      const entityValue =
        mapping.entityKey === 'entityExternalId'
          ? notification.entityExternalId
          : notification.entityRefId;

      return {
        responseCode: 'OK',
        message: 'Navigate from notification',
        data: {
          actionId: mapping.actionId,
          entityId: entityValue ?? '',
          notification
        }
      };
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-notification-dashboard-appointments',
    execute: async () => {
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'DashboardNav', { activeItem: 'appointments' });
      return {
        responseCode: 'OK',
        message: 'Open dashboard appointments',
        onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
      };
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-notification-appointment',
    execute: async (request) => {
      const appointmentId = String(
        request.data?.entityId ?? request.data?.appointmentId ?? request.data?.entityRefId ?? ''
      ).trim();
      const appStore = useAppStore(pinia);
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(authSession.role ?? 'PATIENT').trim().toUpperCase();
      const dashboardPage = 'dashboard';
      appStore.setData('hospital', 'DashboardNav', { activeItem: 'appointments' });
      if (appointmentId) {
        appStore.setData('hospital', 'NotificationUiState', {
          highlightAppointmentId: appointmentId
        });
      }
      return {
        responseCode: 'OK',
        message: 'Open appointment from notification',
        onSuccess: {
          actionType: 'navigate',
          navigate: { packageName: 'hospital', pageId: dashboardPage }
        }
      };
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-notification-video-call',
    execute: async (request) => {
      const appointmentId = String(
        request.data?.entityId ?? request.data?.appointmentId ?? request.data?.entityRefId ?? ''
      ).trim();
      if (!appointmentId) {
        return { responseCode: 'VIDEO_CALL_OPEN_FAILED', message: 'Missing appointment id' };
      }
      writeNotificationsState({ panelOpen: false });
      return {
        responseCode: 'OK',
        message: 'Open video call from notification',
        onSuccess: {
          actionType: 'execute',
          execute: {
            actionId: 'open-appointment-video-call',
            data: { appointmentId }
          }
        }
      };
    }
  }
];
