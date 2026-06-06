let notificationSubscription: { unsubscribe: () => void } | null = null;
let notificationPollTimer: ReturnType<typeof setInterval> | null = null;

export function getNotificationSubscription(): { unsubscribe: () => void } | null {
  return notificationSubscription;
}

export function setNotificationSubscription(sub: { unsubscribe: () => void } | null): void {
  notificationSubscription = sub;
}

export function clearNotificationSubscription(): void {
  if (notificationSubscription) {
    notificationSubscription.unsubscribe();
    notificationSubscription = null;
  }
}

export function getNotificationPollTimer(): ReturnType<typeof setInterval> | null {
  return notificationPollTimer;
}

export function setNotificationPollTimer(timer: ReturnType<typeof setInterval> | null): void {
  notificationPollTimer = timer;
}

export function clearNotificationPollTimer(): void {
  if (notificationPollTimer) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = null;
  }
}
