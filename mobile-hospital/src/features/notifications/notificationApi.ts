import {
  notificationReadPath,
  parseNotificationPage,
  parseUnreadNotificationCount,
  SERVER_PATHS
} from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';

export async function fetchNotifications(): Promise<ReturnType<typeof parseNotificationPage>> {
  const response = await apiClient.get(SERVER_PATHS.notifications, {
    params: { page: 0, size: 20, sort: 'createdAt,desc' }
  });
  return parseNotificationPage(response.data);
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await apiClient.get(SERVER_PATHS.notificationsUnreadCount);
  return parseUnreadNotificationCount(response.data);
}

export async function markNotificationRead(externalId: string): Promise<void> {
  await apiClient.patch(notificationReadPath(externalId));
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch(SERVER_PATHS.notificationsReadAll);
}
