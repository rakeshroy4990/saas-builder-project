import { create } from 'zustand';

import { EMPTY_VIDEO_CALL_STATE, type VideoCallState } from './types';

interface VideoCallStore extends VideoCallState {
  patch: (partial: Partial<VideoCallState>) => void;
  reset: () => void;
}

export const useVideoCallStore = create<VideoCallStore>((set) => ({
  ...EMPTY_VIDEO_CALL_STATE,
  patch: (partial) => set((state) => ({ ...state, ...partial })),
  reset: () => set({ ...EMPTY_VIDEO_CALL_STATE })
}));

export function resetVideoCallState(): void {
  useVideoCallStore.getState().reset();
}

export function getVideoCallSnapshot(): VideoCallState {
  const s = useVideoCallStore.getState();
  return {
    callId: s.callId,
    lastSignalType: s.lastSignalType,
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    inviteToUserId: s.inviteToUserId,
    inviteAppointmentId: s.inviteAppointmentId,
    remotePartyName: s.remotePartyName,
    videoSessionPeerUserId: s.videoSessionPeerUserId,
    videoCallOutgoingInvite: s.videoCallOutgoingInvite,
    webrtcCalleeAccepted: s.webrtcCalleeAccepted,
    videoSession: s.videoSession,
    incomingRing: s.incomingRing
  };
}
