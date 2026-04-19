import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { clearCallHeartbeatTimer } from './callState';

/**
 * Clears hospital `VideoCall` Pinia state after a session ends (local End/Reject or remote STOMP).
 * Keeps unrelated keys via spread; does not tear down the STOMP `/user/queue/webrtc` subscription.
 */
export function resetHospitalVideoCallPiniaState(): void {
  clearCallHeartbeatTimer();
  const appStore = useAppStore(pinia);
  const existing = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'VideoCall', {
    ...existing,
    callId: '',
    lastSignalType: '',
    fromUserId: '',
    toUserId: '',
    payload: {},
    inviteToUserId: '',
    inviteAppointmentId: '',
    videoCallOutgoingInvite: false,
    webrtcRemoteDescription: undefined,
    webrtcIceInbound: [],
    videoSession: undefined,
    videoSessionPeerUserId: '',
    remotePartyName: ''
  });
}

export function closeVideoCallPopupIfOpen(): void {
  const popup = usePopupStore(pinia);
  const pageId = String(popup.activePageId ?? popup.pageId ?? '').trim();
  if (popup.isOpen && !popup.isError && pageId === 'video-call-popup') {
    popup.close();
  }
}
