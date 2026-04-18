import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { stompClient } from '../../../realtime/stompClient';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import {
  clearCallHeartbeatTimer,
  clearWebrtcSubscription,
  setCallHeartbeatTimer
} from '../shared/callState';
import { subscribeHospitalWebRtcInboundIfNeeded } from '../shared/hospitalWebRtcInbound';

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
        webrtcIceInbound: []
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
        await publishWebRtcSignal({
          type: 'invite',
          toUserId,
          payload: { displayName: callerLabel }
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
      try {
        await publishWebRtcSignal({ type: 'accept', callId, payload: {} });
        return ok();
      } catch (err: unknown) {
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
      const data = (request?.data ?? {}) as Record<string, unknown>;
      const callId = String(data.callId ?? data.CallId ?? '').trim();
      if (!callId) {
        console.error('[STOMP] call-reject: missing callId', { data });
        return { responseCode: 'CALL_REJECT_FAILED', message: 'Missing callId' };
      }
      try {
        await publishWebRtcSignal({ type: 'reject', callId, payload: {} });
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
      const data = (request?.data ?? {}) as Record<string, unknown>;
      const callId = String(data.callId ?? data.CallId ?? '').trim();
      if (!callId) {
        console.error('[STOMP] call-end: missing callId', { data });
        return { responseCode: 'CALL_END_FAILED', message: 'Missing callId' };
      }
      try {
        await publishWebRtcSignal({ type: 'end', callId, payload: {} });
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
