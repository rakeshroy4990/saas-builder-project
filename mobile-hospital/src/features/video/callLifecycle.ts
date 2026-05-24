import {
  clearCallHeartbeatTimer,
  publishCallEnd,
  publishCallInvite,
  publishCallReject
} from './callSignals';
import { endAppointmentCall } from './api';
import { hasJoinableVideoSession, prepareVideoSession } from './prepareVideoSession';
import { resetVideoCallState, useVideoCallStore } from './videoCallStore';
import { useSessionStore } from '@/auth/sessionStore';

export async function sendOutgoingAppointmentInvite(): Promise<void> {
  const call = useVideoCallStore.getState();
  if (!call.videoCallOutgoingInvite) return;
  if (!hasJoinableVideoSession()) {
    throw new Error('Video session is not ready');
  }
  const toUserId = String(call.inviteToUserId ?? '').trim();
  if (!toUserId) return;

  const session = useSessionStore.getState().user;
  const callerLabel = session?.displayName || session?.email || 'Caller';
  const payload: Record<string, unknown> = { displayName: callerLabel };
  const appointmentId = String(call.inviteAppointmentId ?? '').trim();
  if (appointmentId) {
    payload.appointmentId = appointmentId;
  }
  await publishCallInvite(toUserId, payload);
  useVideoCallStore.getState().patch({ videoCallOutgoingInvite: false });
}

export async function startOutgoingCall(): Promise<void> {
  await prepareVideoSession();
  await sendOutgoingAppointmentInvite();
}

export async function teardownCall(): Promise<void> {
  const call = useVideoCallStore.getState();
  const appointmentId = String(call.inviteAppointmentId ?? '').trim();
  const callId = String(call.callId ?? '').trim();

  clearCallHeartbeatTimer();

  if (callId) {
    try {
      await publishCallEnd(callId);
    } catch {
      // best-effort
    }
  }

  if (appointmentId) {
    try {
      await endAppointmentCall(appointmentId);
    } catch {
      // best-effort
    }
  }

  try {
    const { releaseAgoraWebRoom } = await import('./AgoraWebRoom');
    await releaseAgoraWebRoom();
  } catch {
    // WebView room may not be mounted
  }
  resetVideoCallState();
}

export async function rejectIncomingCall(): Promise<void> {
  const callId = String(useVideoCallStore.getState().callId ?? '').trim();
  if (callId) {
    try {
      await publishCallReject(callId);
    } catch {
      // best-effort
    }
  }
  await teardownCall();
}
