import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { stompClient } from '../../../realtime/stompClient';
import { logClient } from '../../../logging/clientLogger';
import { getWebrtcSubscription, setWebrtcSubscription } from './callState';

const inviteToastCallIds = new Set<string>();

/**
 * Extract offer/answer SDP from STOMP payload without mangling line endings.
 * Do not use `String(x).trim()` on SDP — trailing CRLF is required by many parsers.
 */
function sdpStringFromOfferAnswerPayload(pl: Record<string, unknown>): string {
  const unwrap = (v: unknown): string => {
    if (typeof v === 'string' && v.length > 0) return v.replace(/^\uFEFF/, '');
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const inner = o.sdp ?? o.Sdp;
      if (typeof inner === 'string' && inner.length > 0) return inner.replace(/^\uFEFF/, '');
    }
    return '';
  };
  const direct = unwrap(pl.sdp ?? pl.Sdp);
  if (direct) return direct;
  return unwrap(pl);
}

function samePrincipalUserId(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return Boolean(x && y && x === y);
}

/**
 * Subscribes to `/user/queue/webrtc` once per browser tab so invite/offer/answer/ICE
 * reach the user even before they open the video popup (otherwise only the caller
 * had run `call-connect` via popup `initializeActions`).
 */
export function subscribeHospitalWebRtcInboundIfNeeded(): void {
  if (getWebrtcSubscription()) return;

  const appStore = useAppStore(pinia);
  setWebrtcSubscription(
    stompClient.subscribe('/user/queue/webrtc', (msg) => {
      try {
        const raw = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
        const pl = (raw.payload ?? (raw as Record<string, unknown>).Payload ?? {}) as Record<string, unknown>;
        const get = (a: string, b: string) =>
          String((raw as Record<string, unknown>)[a] ?? (raw as Record<string, unknown>)[b] ?? '').trim();
        const signalTypeRaw = get('signalType', 'SignalType');
        const signalTypeNorm = signalTypeRaw.toLowerCase();
        const callId = get('callId', 'CallId');
        const fromUserId = get('fromUserId', 'FromUserId');
        const toUserId = get('toUserId', 'ToUserId');
        const displayHint = String(
          pl.displayName ?? pl.DisplayName ?? pl.callerName ?? pl.CallerName ?? ''
        ).trim();
        const call = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        /** Label chosen in `open-appointment-video-call` — must survive invite STOMP echoes to the caller. */
        const priorRemotePartyName = String(call.remotePartyName ?? '').trim();
        const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
        const myUserId = String(session.userId ?? '').trim();
        const myEmail = String(session.email ?? '').trim().toLowerCase();
        const myDisplay = String(session.userDisplayName ?? session.fullName ?? '').trim().toLowerCase();
        const hintNorm = displayHint.trim().toLowerCase();
        const looksLikeSelf =
          hintNorm &&
          (hintNorm === myDisplay ||
            (myEmail && hintNorm === myEmail) ||
            (myEmail && hintNorm === myEmail.split('@')[0]));
        const showPeerName = Boolean(
          displayHint && myUserId && fromUserId && !samePrincipalUserId(fromUserId, myUserId) && !looksLikeSelf
        );

        const next: Record<string, unknown> = {
          ...call,
          lastSignalType: signalTypeRaw,
          fromUserId,
          toUserId,
          payload: pl
        };
        if (callId) next.callId = callId;

        if (signalTypeNorm === 'invite') {
          const imCallee = Boolean(myUserId && toUserId && samePrincipalUserId(toUserId, myUserId));
          if (imCallee && fromUserId && !samePrincipalUserId(fromUserId, myUserId)) {
            next.remotePartyName = displayHint || 'Patient';
            next.videoCallOutgoingInvite = false;
            /**
             * Dashboard `open-appointment-video-call` sets `inviteToUserId` for an *outbound* call.
             * If the patient rings in first, that stale id makes DynVideoCall treat us as the caller
             * (`outgoing`), so `startAsCallee` never runs → black remote after Accept.
             */
            next.inviteToUserId = '';
            if (callId && !inviteToastCallIds.has(callId)) {
              inviteToastCallIds.add(callId);
              if (inviteToastCallIds.size > 40) inviteToastCallIds.clear();
              useToastStore(pinia).show('Incoming video call. Opening video window…', 'info');
            }
          }
          if (import.meta.env.DEV) {
            void logClient('DEBUG', 'WebRTC invite frame', {
              myUserId,
              fromUserId,
              toUserId,
              callId,
              imCallee,
              displayHint: displayHint || null
            });
          }
        } else if (showPeerName && signalTypeNorm !== 'invite') {
          next.remotePartyName = displayHint;
        }

        if (signalTypeNorm === 'offer' || signalTypeNorm === 'answer') {
          const imSignalingCallee = Boolean(
            myUserId && toUserId && samePrincipalUserId(toUserId, myUserId) && fromUserId && !samePrincipalUserId(fromUserId, myUserId)
          );
          if (signalTypeNorm === 'offer' && imSignalingCallee) {
            next.inviteToUserId = '';
          }
          const sdp = sdpStringFromOfferAnswerPayload(pl);
          const typ = String(pl.type ?? pl.Type ?? signalTypeRaw).trim();
          if (sdp) {
            next.webrtcRemoteDescription = { type: typ, sdp };
          } else {
            console.error('[STOMP] webrtc offer/answer missing sdp', {
              signalTypeNorm,
              callId,
              fromUserId,
              toUserId,
              payloadKeys: pl ? Object.keys(pl) : [],
              sdpFieldTypes: {
                sdp: pl?.sdp != null ? typeof pl.sdp : 'absent',
                Sdp: pl?.Sdp != null ? typeof pl.Sdp : 'absent'
              }
            });
          }
        } else if (signalTypeNorm === 'ice') {
          const q = Array.isArray(call.webrtcIceInbound) ? ([...call.webrtcIceInbound] as unknown[]) : [];
          q.push(pl);
          next.webrtcIceInbound = q;
        }

        // Invite echoed back to the initiator: payload.displayName is the caller (self), not the peer.
        if (
          signalTypeNorm === 'invite' &&
          priorRemotePartyName &&
          myUserId &&
          fromUserId &&
          samePrincipalUserId(fromUserId, myUserId)
        ) {
          next.remotePartyName = priorRemotePartyName;
        }

        appStore.setData('hospital', 'VideoCall', next);

        if (signalTypeNorm === 'invite') {
          const imCalleeOpen = Boolean(myUserId && toUserId && samePrincipalUserId(toUserId, myUserId));
          if (imCalleeOpen && fromUserId && !samePrincipalUserId(fromUserId, myUserId) && callId) {
            usePopupStore(pinia).open({
              packageName: 'hospital',
              pageId: 'video-call-popup',
              title: 'Video Call',
              initKey: `incoming-${callId}-${Date.now()}`
            });
          }
        }
      } catch (err: unknown) {
        console.error('[STOMP] /user/queue/webrtc handler error', err, {
          rawPreview: String(msg.body ?? '').slice(0, 400)
        });
      }
    })
  );
}

/** Connect STOMP (if needed) and ensure the hospital WebRTC inbound subscription exists. */
export async function ensureHospitalWebRtcInboundConnected(): Promise<void> {
  try {
    await stompClient.connect();
    subscribeHospitalWebRtcInboundIfNeeded();
  } catch (err: unknown) {
    console.error('[STOMP] ensureHospitalWebRtcInboundConnected failed', err);
    throw err;
  }
}
