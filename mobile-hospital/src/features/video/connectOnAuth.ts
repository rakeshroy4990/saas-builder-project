import { ensureWebRtcInboundConnected, unsubscribeWebRtcInbound } from './stompWebRtcInbound';
import { stompDisconnect } from '@/realtime/stompClient';
import { clearCallHeartbeatTimer } from './callSignals';
import { resetVideoCallState } from './videoCallStore';

export async function connectRealtimeAfterAuth(): Promise<void> {
  try {
    await ensureWebRtcInboundConnected();
  } catch {
    // Non-fatal: video calls can retry when opening call screen
  }
}

export async function disconnectRealtimeOnLogout(): Promise<void> {
  clearCallHeartbeatTimer();
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
