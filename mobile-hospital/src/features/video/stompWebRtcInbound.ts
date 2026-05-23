import type { IMessage } from '@stomp/stompjs';

import { useSessionStore } from '@/auth/sessionStore';
import { stompConnect, stompSubscribe, type SubscriptionHandle } from '@/realtime/stompClient';

import { resetVideoCallState, useVideoCallStore } from './videoCallStore';

let webrtcSubscription: SubscriptionHandle | null = null;
const inviteSeenCallIds = new Set<string>();

function samePrincipalUserId(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return Boolean(x && y && x === y);
}

function handleWebRtcMessage(msg: IMessage): void {
  try {
    const raw = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
    const pl = (raw.payload ?? raw.Payload ?? {}) as Record<string, unknown>;
    const get = (a: string, b: string) =>
      String(raw[a] ?? raw[b] ?? '').trim();
    const signalTypeRaw = get('signalType', 'SignalType');
    const signalTypeNorm = signalTypeRaw.toLowerCase();
    const callId = get('callId', 'CallId');
    const fromUserId = get('fromUserId', 'FromUserId');
    const toUserId = get('toUserId', 'ToUserId');
    const displayHint = String(pl.displayName ?? pl.DisplayName ?? pl.callerName ?? pl.CallerName ?? '').trim();
    const call = useVideoCallStore.getState();

    if (signalTypeNorm === 'end' || signalTypeNorm === 'reject') {
      if (!callId) return;
      const active = String(call.callId ?? '').trim();
      if (active && active !== callId) return;
      resetVideoCallState();
      return;
    }

    const priorRemotePartyName = String(call.remotePartyName ?? '').trim();
    const session = useSessionStore.getState().user;
    const myUserId = String(session?.userId ?? '').trim();
    const myEmail = String(session?.email ?? '').trim().toLowerCase();
    const myDisplay = String(session?.displayName ?? '').trim().toLowerCase();
    const hintNorm = displayHint.trim().toLowerCase();
    const looksLikeSelf =
      hintNorm &&
      (hintNorm === myDisplay ||
        (myEmail && hintNorm === myEmail) ||
        (myEmail && hintNorm === myEmail.split('@')[0]));
    const showPeerName = Boolean(
      displayHint && myUserId && fromUserId && !samePrincipalUserId(fromUserId, myUserId) && !looksLikeSelf
    );

    const next: Partial<typeof call> = {
      lastSignalType: signalTypeRaw,
      fromUserId,
      toUserId
    };
    if (callId) next.callId = callId;

    if (signalTypeNorm === 'invite') {
      const imCallee = Boolean(myUserId && toUserId && samePrincipalUserId(toUserId, myUserId));
      if (imCallee && fromUserId && !samePrincipalUserId(fromUserId, myUserId)) {
        next.remotePartyName = displayHint || 'Patient';
        next.videoCallOutgoingInvite = false;
        next.webrtcCalleeAccepted = false;
        next.inviteToUserId = '';
        next.videoSessionPeerUserId = fromUserId;
        const apptFromInvite = String(pl.appointmentId ?? pl.AppointmentId ?? '').trim();
        if (apptFromInvite) {
          next.inviteAppointmentId = apptFromInvite;
        }
        if (callId && !inviteSeenCallIds.has(callId)) {
          inviteSeenCallIds.add(callId);
          if (inviteSeenCallIds.size > 40) inviteSeenCallIds.clear();
        }
        next.incomingRing = true;
      }
    } else if (showPeerName && signalTypeNorm !== 'invite') {
      next.remotePartyName = displayHint;
    }

    if (
      signalTypeNorm === 'invite' &&
      priorRemotePartyName &&
      myUserId &&
      fromUserId &&
      samePrincipalUserId(fromUserId, myUserId)
    ) {
      next.remotePartyName = priorRemotePartyName;
    }

    useVideoCallStore.getState().patch(next);
  } catch {
    // Ignore malformed STOMP payloads
  }
}

export function subscribeWebRtcInboundIfNeeded(): void {
  if (webrtcSubscription) return;
  const handle = stompSubscribe('/user/queue/webrtc', handleWebRtcMessage);
  if (handle) webrtcSubscription = handle;
}

export function unsubscribeWebRtcInbound(): void {
  webrtcSubscription?.unsubscribe();
  webrtcSubscription = null;
}

export async function ensureWebRtcInboundConnected(): Promise<void> {
  try {
    await stompConnect();
    subscribeWebRtcInboundIfNeeded();
  } catch {
    // Realtime is optional until a video call is started.
  }
}
