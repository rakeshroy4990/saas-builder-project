import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { stompClient } from '../../../realtime/stompClient';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import {
  clearCallHeartbeatTimer,
  clearWebrtcSubscription,
  setCallHeartbeatTimer
} from '../shared/callState';
import { subscribeHospitalWebRtcInboundIfNeeded } from '../shared/hospitalWebRtcInbound';
import {
  closeVideoCallPopupIfOpen,
  resetHospitalVideoCallPiniaState
} from '../shared/hospitalVideoCallStoreReset';
import { getHospitalVideoProviderFromEnv, isBuiltinHospitalVideo } from '../shared/videoProviderConfig';

/**
 * STOMP publish requires a connected client. Default `{}` avoids `undefined` reaching
 * `JSON.stringify` / stompjs when a caller passes a bad payload (e.g. missing `request.data`).
 */
async function publishWebRtcSignal(body: Record<string, unknown> = {}): Promise<void> {
  const envelope =
    body != null && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
  try {
    await stompClient.connect();
    subscribeHospitalWebRtcInboundIfNeeded();
    stompClient.publish('/app/webrtc.signal', envelope);
  } catch (err: unknown) {
    console.error('[STOMP] publishWebRtcSignal failed', { envelope, err });
    throw err;
  }
}

export const callHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'hospital-prepare-video-session',
    responseCodes: { failure: ['HOSPITAL_VIDEO_SESSION_FAILED'] },
    execute: async () => {
      if (isBuiltinHospitalVideo()) {
        return ok({ skipped: true });
      }
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const call = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
      const appointmentId = String(call.inviteAppointmentId ?? '').trim();
      const peerInbound = String(call.videoSessionPeerUserId ?? '').trim();
      const invitePeer = String(call.inviteToUserId ?? '').trim();
      const body: Record<string, unknown> = {};
      if (appointmentId) {
        body.appointmentId = appointmentId;
      } else if (peerInbound) {
        body.peerUserId = peerInbound;
      } else if (invitePeer) {
        body.peerUserId = invitePeer;
      } else {
        return ok({ skipped: true });
      }
      try {
        const response = await apiClient.post(URLRegistry.paths.hospitalVideoSession, body);
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const provider = pickString(data, ['Provider', 'provider']) || getHospitalVideoProviderFromEnv();
        const after = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        if (provider === 'builtin') {
          appStore.setData('hospital', 'VideoCall', { ...after, videoSession: { provider: 'builtin' } });
          return ok({ provider: 'builtin' });
        }
        const uidRaw = data.Uid ?? data.uid;
        const uid =
          typeof uidRaw === 'number' && Number.isFinite(uidRaw)
            ? uidRaw
            : Number.parseInt(String(uidRaw ?? ''), 10) || 0;
        const videoSession = {
          provider,
          roomId: pickString(data, ['RoomId', 'roomId']),
          token: pickString(data, ['Token', 'token']),
          appId: pickString(data, ['AppId', 'appId']),
          expiresAt: pickString(data, ['ExpiresAt', 'expiresAt']),
          uid
        };
        appStore.setData('hospital', 'VideoCall', { ...after, videoSession });
        return ok({ provider: videoSession.provider });
      } catch (err: unknown) {
        console.error('[Video] hospital-prepare-video-session failed', err);
        toastStore.show('Could not prepare video session. Check server video configuration.', 'error');
        return { responseCode: 'HOSPITAL_VIDEO_SESSION_FAILED', message: 'Session request failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-connect',
    execute: async () => {
      const toastStore = useToastStore(pinia);
      try {
        await stompClient.connect();
        subscribeHospitalWebRtcInboundIfNeeded();
        return ok();
      } catch (err: unknown) {
        console.error('[STOMP] call-connect failed', err);
        toastStore.show('Unable to connect to calling right now.', 'error');
        return { responseCode: 'CALL_CONNECT_FAILED', message: 'Unable to connect to calling right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-disconnect',
    execute: async () => {
      clearWebrtcSubscription();
      clearCallHeartbeatTimer();
      const appStore = useAppStore(pinia);
      const call = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'VideoCall', {
        ...call,
        webrtcRemoteDescription: undefined,
        webrtcIceInbound: [],
        videoSession: undefined,
        videoSessionPeerUserId: '',
        webrtcCalleeAccepted: false
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-invite',
    responseCodes: { failure: ['CALL_INVITE_FAILED'] },
    execute: async (request) => {
      const toastStore = useToastStore(pinia);
      const data = (request?.data ?? {}) as Record<string, unknown>;
      const toUserId = String(data.toUserId ?? data.ToUserId ?? '').trim();
      if (!toUserId) {
        console.error('[STOMP] call-invite: missing toUserId', { data });
        return { responseCode: 'CALL_INVITE_FAILED', message: 'Missing user' };
      }
      try {
        await publishWebRtcSignal({ type: 'invite', toUserId, payload: {} });
        return ok();
      } catch (err: unknown) {
        console.error('[STOMP] call-invite failed', { toUserId, err });
        toastStore.show('Could not send invite. Check your connection and try again.', 'error');
        return { responseCode: 'CALL_INVITE_FAILED', message: 'Publish failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-send-appointment-invite',
    responseCodes: { failure: ['CALL_INVITE_FAILED'] },
    execute: async () => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const call = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
      if (!Boolean(call.videoCallOutgoingInvite)) {
        return ok({ skipped: true });
      }
      const toUserId = String(call.inviteToUserId ?? '').trim();
      if (!toUserId) {
        return ok({ skipped: true });
      }
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const callerLabel =
        pickString(authSession, [
          'fullName',
          'FullName',
          'userDisplayName',
          'UserDisplayName',
          'loginDisplayName',
          'LoginDisplayName',
          'email',
          'Email'
        ]) || 'Caller';
      try {
        const inviteAppointmentId = String(call.inviteAppointmentId ?? '').trim();
        const payload: Record<string, unknown> = { displayName: callerLabel };
        if (inviteAppointmentId) {
          payload.appointmentId = inviteAppointmentId;
        }
        await publishWebRtcSignal({
          type: 'invite',
          toUserId,
          payload
        });
        const after = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        appStore.setData('hospital', 'VideoCall', { ...after, videoCallOutgoingInvite: false });
        return ok({ toUserId });
      } catch (err: unknown) {
        console.error('[STOMP] call-send-appointment-invite failed', { toUserId, err });
        toastStore.show('Could not send call invite. Check network and login, then try again.', 'error');
        return { responseCode: 'CALL_INVITE_FAILED', message: 'Publish failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-accept',
    responseCodes: { failure: ['CALL_ACCEPT_FAILED'] },
    execute: async (request) => {
      const toastStore = useToastStore(pinia);
      const data = (request?.data ?? {}) as Record<string, unknown>;
      const callId = String(data.callId ?? data.CallId ?? '').trim();
      if (!callId) {
        console.error('[STOMP] call-accept: missing callId', { data });
        return { responseCode: 'CALL_ACCEPT_FAILED', message: 'Missing callId' };
      }
      const appStore = useAppStore(pinia);
      try {
        const snap = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        /** Lets builtin WebRTC wait for Accept before `setRemoteDescription(offer)` (avoids remote preview early). */
        appStore.setData('hospital', 'VideoCall', { ...snap, webrtcCalleeAccepted: true });
        await publishWebRtcSignal({ type: 'accept', callId, payload: {} });
        return ok();
      } catch (err: unknown) {
        const afterFail = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        appStore.setData('hospital', 'VideoCall', { ...afterFail, webrtcCalleeAccepted: false });
        console.error('[STOMP] call-accept failed', { callId, err });
        toastStore.show('Could not accept the call. Check your connection and try again.', 'error');
        return { responseCode: 'CALL_ACCEPT_FAILED', message: 'Publish failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-reject',
    responseCodes: { failure: ['CALL_REJECT_FAILED'] },
    execute: async (request) => {
      const toastStore = useToastStore(pinia);
      const appStore = useAppStore(pinia);
      const data = (request?.data ?? {}) as Record<string, unknown>;
      let callId = String(data.callId ?? data.CallId ?? '').trim();
      if (!callId) {
        const snap = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        callId = String(snap.callId ?? '').trim();
      }
      if (!callId) {
        resetHospitalVideoCallPiniaState();
        closeVideoCallPopupIfOpen();
        return ok({ skipped: true });
      }
      try {
        await publishWebRtcSignal({ type: 'reject', callId, payload: {} });
        resetHospitalVideoCallPiniaState();
        closeVideoCallPopupIfOpen();
        return ok();
      } catch (err: unknown) {
        console.error('[STOMP] call-reject failed', { callId, err });
        toastStore.show('Could not reject the call. Check your connection and try again.', 'error');
        return { responseCode: 'CALL_REJECT_FAILED', message: 'Publish failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-end',
    responseCodes: { failure: ['CALL_END_FAILED'] },
    execute: async (request) => {
      const toastStore = useToastStore(pinia);
      const appStore = useAppStore(pinia);
      const data = (request?.data ?? {}) as Record<string, unknown>;
      let callId = String(data.callId ?? data.CallId ?? '').trim();
      if (!callId) {
        const snap = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
        callId = String(snap.callId ?? '').trim();
      }
      if (!callId) {
        resetHospitalVideoCallPiniaState();
        closeVideoCallPopupIfOpen();
        return ok({ skipped: true });
      }
      try {
        await publishWebRtcSignal({ type: 'end', callId, payload: {} });
        resetHospitalVideoCallPiniaState();
        closeVideoCallPopupIfOpen();
        return ok();
      } catch (err: unknown) {
        console.error('[STOMP] call-end failed', { callId, err });
        toastStore.show('Could not end the call. Check your connection and try again.', 'error');
        return { responseCode: 'CALL_END_FAILED', message: 'Publish failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-heartbeat',
    responseCodes: { failure: ['CALL_HEARTBEAT_FAILED'] },
    execute: async (request) => {
      const toastStore = useToastStore(pinia);
      const data = (request?.data ?? {}) as Record<string, unknown>;
      const callId = String(data.callId ?? data.CallId ?? '').trim();
      if (!callId) {
        console.error('[STOMP] call-heartbeat: missing callId', { data });
        return { responseCode: 'CALL_HEARTBEAT_FAILED', message: 'Missing callId' };
      }
      clearCallHeartbeatTimer();
      try {
        await stompClient.connect();
        subscribeHospitalWebRtcInboundIfNeeded();
      } catch (err: unknown) {
        console.error('[STOMP] call-heartbeat initial connect failed', { callId, err });
        toastStore.show('Unable to connect for call heartbeat.', 'error');
        return { responseCode: 'CALL_HEARTBEAT_FAILED', message: 'Connect failed' };
      }
      setCallHeartbeatTimer(
        window.setInterval(() => {
          void (async () => {
            try {
              await stompClient.connect();
              stompClient.publish('/app/webrtc.signal', { type: 'heartbeat', callId, payload: {} });
            } catch (err: unknown) {
              console.error('[STOMP] call-heartbeat tick failed', { callId, err });
            }
          })();
        }, 5000)
      );
      return ok();
    }
  }
];
