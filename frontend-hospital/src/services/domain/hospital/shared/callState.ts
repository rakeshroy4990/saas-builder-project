let webrtcSubscription: { unsubscribe: () => void } | null = null;
let callHeartbeatTimer: number | null = null;

export function getWebrtcSubscription(): { unsubscribe: () => void } | null {
  return webrtcSubscription;
}

export function setWebrtcSubscription(sub: { unsubscribe: () => void } | null): void {
  webrtcSubscription = sub;
}

export function clearWebrtcSubscription(): void {
  if (webrtcSubscription) {
    webrtcSubscription.unsubscribe();
    webrtcSubscription = null;
  }
}

export function getCallHeartbeatTimer(): number | null {
  return callHeartbeatTimer;
}

export function setCallHeartbeatTimer(id: number | null): void {
  callHeartbeatTimer = id;
}

export function clearCallHeartbeatTimer(): void {
  if (callHeartbeatTimer != null) {
    window.clearInterval(callHeartbeatTimer);
    callHeartbeatTimer = null;
  }
}
