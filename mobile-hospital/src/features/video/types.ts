import type { VideoSessionPayload } from '@saas-builder/hospital-api-client';

export type VideoSession = VideoSessionPayload;

export interface VideoCallState {
  callId: string;
  lastSignalType: string;
  fromUserId: string;
  toUserId: string;
  inviteToUserId: string;
  inviteAppointmentId: string;
  remotePartyName: string;
  videoSessionPeerUserId: string;
  videoCallOutgoingInvite: boolean;
  webrtcCalleeAccepted: boolean;
  videoSession?: VideoSession;
  /** Set when an incoming invite should open the call UI */
  incomingRing: boolean;
}

export const EMPTY_VIDEO_CALL_STATE: VideoCallState = {
  callId: '',
  lastSignalType: '',
  fromUserId: '',
  toUserId: '',
  inviteToUserId: '',
  inviteAppointmentId: '',
  remotePartyName: '',
  videoSessionPeerUserId: '',
  videoCallOutgoingInvite: false,
  webrtcCalleeAccepted: false,
  videoSession: undefined,
  incomingRing: false
};
