import { stompConnect, stompPublish } from '@/realtime/stompClient';

import { useVideoCallStore } from './videoCallStore';

const WEBRTC_DEST = '/app/webrtc.signal';

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function clearCallHeartbeatTimer(): void {
  if (heartbeatTimer != null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function publishSignal(body: Record<string, unknown>): Promise<void> {
  try {
    await stompConnect();
    stompPublish(WEBRTC_DEST, body);
  } catch {
    // Signaling is best-effort when the broker is unavailable.
  }
}

export async function publishCallInvite(
  toUserId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await publishSignal({ type: 'invite', toUserId, payload });
}

export async function publishCallAccept(callId: string): Promise<void> {
  useVideoCallStore.getState().patch({ webrtcCalleeAccepted: true });
  await publishSignal({ type: 'accept', callId, payload: {} });
}

export async function publishCallReject(callId: string): Promise<void> {
  await publishSignal({ type: 'reject', callId, payload: {} });
}

export async function publishCallEnd(callId: string): Promise<void> {
  await publishSignal({ type: 'end', callId, payload: {} });
}

export function startCallHeartbeat(callId: string): void {
  clearCallHeartbeatTimer();
  heartbeatTimer = setInterval(() => {
    void (async () => {
      try {
        await stompConnect();
        stompPublish(WEBRTC_DEST, { type: 'heartbeat', callId, payload: {} });
      } catch {
        // Best-effort keepalive
      }
    })();
  }, 5000);
}
