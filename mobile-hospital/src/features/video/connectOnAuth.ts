import { ensureWebRtcInboundConnected, unsubscribeWebRtcInbound } from './stompWebRtcInbound';
import { hydrateNotifications, subscribeNotifications, unsubscribeNotifications } from '@/features/notifications/stompNotifications';
import { stompConnect, stompDisconnect } from '@/realtime/stompClient';
import { clearCallHeartbeatTimer } from './callSignals';
import { resetVideoCallState } from './videoCallStore';

export async function connectRealtimeAfterAuth(): Promise<void> {
  try {
    await stompConnect();
    await ensureWebRtcInboundConnected();
    await subscribeNotifications();
    await hydrateNotifications();
  } catch {
    // Non-fatal: video calls and notifications can retry when opening screens
    try {
      await hydrateNotifications();
    } catch {
      // no-op
    }
  }
}

export async function disconnectRealtimeOnLogout(): Promise<void> {
  clearCallHeartbeatTimer();
  unsubscribeNotifications();
  try {
    const { releaseAgoraWebRoom } = await import('./AgoraWebRoom');
    await releaseAgoraWebRoom();
  } catch {
    // Agora WebView may not be mounted
  }
  resetVideoCallState();
  unsubscribeWebRtcInbound();
  stompDisconnect();
}
