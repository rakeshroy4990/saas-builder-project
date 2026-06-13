import type { NotificationItem } from '@saas-builder/hospital-api-client';

export type NotificationRouteResolver = (notification: NotificationItem) => string | null;

export const notificationRouteResolvers: Record<string, NotificationRouteResolver> = {
  APPOINTMENT_CREATED: (notification) => resolveAppointmentRoute(notification),
  APPOINTMENT_UPDATED: (notification) => resolveAppointmentRoute(notification),
  APPOINTMENT_DELETED: () => '/(app)/(tabs)/appointments',
  PRESCRIPTION_UPLOADED: (notification) => resolveAppointmentRoute(notification),
  VIDEO_CALL_STARTED: (notification) => resolveAppointmentRoute(notification),
  DOCTOR_APPROVED: () => '/(app)/(tabs)/profile',
  USER_REGISTERED: () => '/(app)/(tabs)/appointments'
};

function resolveAppointmentRoute(notification: NotificationItem): string | null {
  const appointmentId = String(notification.entityRefId ?? notification.entityExternalId ?? '').trim();
  if (!appointmentId) return '/(app)/(tabs)/appointments';
  return `/(app)/(tabs)/appointments/${encodeURIComponent(appointmentId)}`;
}

export function resolveNotificationRoute(notification: NotificationItem): string | null {
  const resolver = notificationRouteResolvers[String(notification.eventType ?? '').trim()];
  return resolver ? resolver(notification) : '/(app)/(tabs)/home';
}
