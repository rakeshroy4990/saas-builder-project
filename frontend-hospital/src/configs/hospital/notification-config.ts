export type NotificationActionConfig = {
  actionId: string;
  entityKey?: 'entityRefId' | 'entityExternalId';
};

export const NOTIFICATION_ACTION_MAP: Record<string, NotificationActionConfig> = {
  APPOINTMENT_CREATED: { actionId: 'open-notification-appointment', entityKey: 'entityRefId' },
  APPOINTMENT_UPDATED: { actionId: 'open-notification-appointment', entityKey: 'entityRefId' },
  APPOINTMENT_DELETED: { actionId: 'open-notification-dashboard-appointments' },
  PRESCRIPTION_UPLOADED: { actionId: 'open-notification-appointment', entityKey: 'entityRefId' },
  VIDEO_CALL_STARTED: { actionId: 'open-notification-video-call', entityKey: 'entityRefId' },
  DOCTOR_APPROVED: { actionId: 'navigate-profile' },
  USER_REGISTERED: { actionId: 'set-dashboard-admin-tab' }
};

export function resolveNotificationAction(eventType: string): NotificationActionConfig | null {
  return NOTIFICATION_ACTION_MAP[String(eventType ?? '').trim()] ?? null;
}
