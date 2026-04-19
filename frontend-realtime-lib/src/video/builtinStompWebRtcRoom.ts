import { ref, shallowRef, watch, type ComputedRef, type Ref, type WatchStopHandle } from 'vue';
import { getIceServersFromEnv, iceServerListHasTurn } from '../iceServers';

export type AppStoreSlice = {
  getData: (pkg: string, key: string) => unknown;
  setData: (pkg: string, key: string, data: Record<string, unknown>) => void;
};

export type BuiltinStompWebRtcContext = {
  call: ComputedRef<Record<string, unknown>>;
  callId: ComputedRef<string>;
  pkg: ComputedRef<string>;
  key: ComputedRef<string>;
  localVideo: Ref<HTMLVideoElement | null>;
  remoteVideo: Ref<HTMLVideoElement | null>;
  sessionActive: Ref<boolean>;
  appStore: AppStoreSlice;
  publishSignal: (type: string, callId: string, payload: Record<string, unknown>) => void;
  getEnv: () => Record<string, unknown>;
  isDev: () => boolean;
};

export type BuiltinStompWebRtcRoom = {
  mediaError: Ref<string>;
  mount: () => void;
  unmount: () => void;
};

export function createBuiltinStompWebRtcRoom(ctx: BuiltinStompWebRtcContext): BuiltinStompWebRtcRoom {
  function rtcPeerConnectionConfig(): RTCConfiguration {
    const env = ctx.getEnv() as Record<string, unknown>;
    const iceServers = getIceServersFromEnv(env);
    const c: RTCConfiguration = {
      iceServers,
      iceCandidatePoolSize: 10
    };
    const policy = String(env.VITE_WEBRTC_ICE_TRANSPORT_POLICY ?? '').trim().toLowerCase();
    if (policy === 'relay' && iceServerListHasTurn(iceServers)) {
      c.iceTransportPolicy = 'relay';
    }
    return c;
  }

  function rtcFlow(phase: string, detail?: Record<string, unknown>) {
    if (detail && Object.keys(detail).length > 0) {
      console.info(`[WebRTC][flow] ${phase}`, detail);
    } else {
      console.info(`[WebRTC][flow] ${phase}`);
    }
  }

  function normalizeWebRtcSdp(raw: string): string {
    if (!raw) return raw;
    let s = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    if (!s.endsWith('\n')) s += '\n';
    return s;
  }

  const localStream = ref<MediaStream | null>(null);
  const pc = shallowRef<RTCPeerConnection | null>(null);
  const negotiatedForCallId = ref<string | null>(null);
  const appliedRemoteAnswer = ref(false);
  const lastIceProcessedLength = ref(0);
  const mediaError = ref('');

  type ReleasePeerOptions = { clearStoredRemoteDescription?: boolean };

  async function releasePeer(opts?: ReleasePeerOptions) {
    rtcFlow('releasePeer');
    const curPc = pc.value;
    if (curPc) remoteInboundByPeer.delete(curPc);
    localStream.value?.getTracks().forEach((t) => t.stop());
    localStream.value = null;
    curPc?.getSenders().forEach((s) => {
      try {
        s.track?.stop();
      } catch {
        // no-op
      }
    });
    curPc?.close();
    pc.value = null;
    if (ctx.localVideo.value) ctx.localVideo.value.srcObject = null;
    if (ctx.remoteVideo.value) ctx.remoteVideo.value.srcObject = null;
    negotiatedForCallId.value = null;
    appliedRemoteAnswer.value = false;
    lastIceProcessedLength.value = 0;

    const snap = (ctx.appStore.getData(ctx.pkg.value, ctx.key.value) ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      ...snap,
      /** Old candidates target the previous peer; reopening the popup must not replay them. */
      webrtcIceInbound: []
    };
    if (opts?.clearStoredRemoteDescription) {
      patch.webrtcRemoteDescription = undefined;
    }
    ctx.appStore.setData(ctx.pkg.value, ctx.key.value, patch);
  }

  async function ensureLocalMedia(): Promise<MediaStream> {
    if (localStream.value) {
      if (ctx.isDev()) {
        rtcFlow('ensureLocalMedia.cached', {
          tracks: localStream.value.getTracks().map((t) => ({ kind: t.kind, enabled: t.enabled }))
        });
      }
      return localStream.value;
    }
    try {
      rtcFlow('ensureLocalMedia.request');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStream.value = stream;
      if (ctx.localVideo.value) {
        ctx.localVideo.value.srcObject = stream;
        await ctx.localVideo.value.play().catch(() => undefined);
      }
      mediaError.value = '';
      rtcFlow('ensureLocalMedia.ok', {
        tracks: stream.getTracks().map((t) => ({ kind: t.kind, label: t.label?.slice(0, 40) }))
      });
      return stream;
    } catch (err: unknown) {
      console.error('[WebRTC] getUserMedia failed', err);
      mediaError.value = 'Camera or microphone permission is required for video calls.';
      throw new Error('getUserMedia failed');
    }
  }

  function isBenignVideoPlayAbort(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      String((err as { name: string }).name) === 'AbortError'
    );
  }

  const remoteInboundByPeer = new WeakMap<RTCPeerConnection, MediaStream>();
  const iceDisconnectedStableWarned = new WeakSet<RTCPeerConnection>();

  function attachRemoteInboundToVideoEl(ms: MediaStream): boolean {
    const el = ctx.remoteVideo.value;
    if (!el) return false;
    if (el.srcObject !== ms) {
      el.srcObject = ms;
    }
    void el.play().catch((err: unknown) => {
      if (isBenignVideoPlayAbort(err)) return;
      console.error('[WebRTC] remote video play() failed', err);
    });
    return true;
  }

  /**
   * Some browsers attach incoming media to `RTCRtpReceiver.track` without firing `ontrack` for every
   * path; merge receiver tracks into the same inbound stream we use for `<video>`.
   */
  function syncReceiverTracksToRemoteVideo(peer: RTCPeerConnection, reason: string) {
    const inboundRemote = remoteInboundByPeer.get(peer);
    if (!inboundRemote) return;
    let added = 0;
    for (const r of peer.getReceivers()) {
      const t = r.track;
      if (t && !inboundRemote.getTracks().includes(t)) {
        inboundRemote.addTrack(t);
        added += 1;
      }
    }
    if (inboundRemote.getTracks().length === 0) return;
    const el = ctx.remoteVideo.value;
    const needsPlay = added > 0 || el?.srcObject !== inboundRemote;
    if (needsPlay) {
      if (!attachRemoteInboundToVideoEl(inboundRemote)) {
        queueMicrotask(() => {
          attachRemoteInboundToVideoEl(inboundRemote);
        });
      }
      if (ctx.isDev() && added > 0) {
        rtcFlow('syncReceiverTracks', {
          reason,
          added,
          total: inboundRemote.getTracks().length,
          kinds: inboundRemote.getTracks().map((t) => t.kind)
        });
      }
    }
  }

  function parseIceChunk(chunk: Record<string, unknown>): RTCIceCandidateInit | null {
    const cand = (chunk.candidate ?? chunk.Candidate ?? chunk) as Record<string, unknown> | string;
    if (typeof cand === 'string') {
      return { candidate: cand };
    }
    if (cand && typeof cand === 'object' && 'candidate' in cand) {
      return cand as RTCIceCandidateInit;
    }
    return null;
  }

  async function drainIceQueue(peer: RTCPeerConnection) {
    if (peer.signalingState === 'closed') {
      if (ctx.isDev()) rtcFlow('drainIceQueue.skip', { reason: 'peer-closed' });
      return;
    }
    /**
     * Remote trickle ICE must not be applied before `setRemoteDescription` (offer for callee, answer
     * for caller). The deep `watch(call)` often runs while only a local offer exists — advancing
     * `lastIceProcessedLength` in that case would drop candidates permanently.
     */
    if (!peer.remoteDescription) {
      if (ctx.isDev()) {
        rtcFlow('drainIceQueue.skip', {
          reason: 'no-remote-description-yet',
          signalingState: peer.signalingState,
          localDesc: peer.localDescription?.type ?? null,
          iceQueueLen: Array.isArray(ctx.call.value.webrtcIceInbound)
            ? (ctx.call.value.webrtcIceInbound as unknown[]).length
            : 0
        });
      }
      return;
    }

    const queue = Array.isArray(ctx.call.value.webrtcIceInbound)
      ? ([...ctx.call.value.webrtcIceInbound] as Record<string, unknown>[])
      : [];
    if (lastIceProcessedLength.value > queue.length) {
      lastIceProcessedLength.value = 0;
    }
    const currentCallId = String(ctx.callId.value ?? '').trim();
    const from = lastIceProcessedLength.value;
    let applied = 0;
    for (let i = from; i < queue.length; i++) {
      const row = queue[i] ?? {};
      const chunkCallId = String(row.webrtcEnvelopeCallId ?? '').trim();
      if (chunkCallId && currentCallId && chunkCallId !== currentCallId) {
        continue;
      }
      const init = parseIceChunk(row);
      if (init?.candidate) {
        try {
          await peer.addIceCandidate(init as RTCIceCandidateInit);
          applied += 1;
        } catch (err: unknown) {
          console.error('[WebRTC] addIceCandidate failed', { index: i, err, init });
        }
      }
    }
    lastIceProcessedLength.value = queue.length;
    const hadPending = from < queue.length;
    if (applied > 0 || (ctx.isDev() && hadPending)) {
      rtcFlow('drainIceQueue', {
        remoteDesc: peer.remoteDescription?.type ?? null,
        signalingState: peer.signalingState,
        fromIndex: from,
        queueLen: queue.length,
        applied
      });
    }
  }

  /**
   * Unified Plan often fires `ontrack` once per m-line; each `ev.streams[0]` may hold only that track.
   * Replacing `srcObject` with the latest single-track stream drops the other kind (e.g. video after
   * audio) → black remote tile. Merge every `streams[]` / `track` into one MediaStream instead.
   */
  function bindRemoteStream(peer: RTCPeerConnection) {
    const inboundRemote = new MediaStream();
    remoteInboundByPeer.set(peer, inboundRemote);
    rtcFlow('bindRemoteStream');
    peer.ontrack = (ev: RTCTrackEvent) => {
      const mergeTrack = (t: MediaStreamTrack) => {
        if (!inboundRemote.getTracks().includes(t)) {
          inboundRemote.addTrack(t);
        }
      };
      for (const stream of ev.streams) {
        for (const t of stream.getTracks()) {
          mergeTrack(t);
        }
      }
      if (ev.track) mergeTrack(ev.track);
      if (inboundRemote.getTracks().length === 0) {
        console.error('[WebRTC] ontrack: no tracks on event', ev);
        return;
      }

      rtcFlow('ontrack', {
        streams: ev.streams.length,
        mergedTracks: inboundRemote.getTracks().map((t) => ({
          kind: t.kind,
          id: t.id,
          muted: t.muted,
          readyState: t.readyState
        }))
      });

      if (!attachRemoteInboundToVideoEl(inboundRemote)) {
        queueMicrotask(() => {
          if (!attachRemoteInboundToVideoEl(inboundRemote)) {
            console.error('[WebRTC] ontrack: remoteVideo ref still missing after microtask');
          }
        });
      }
    };

    peer.onconnectionstatechange = () => {
      const s = peer.connectionState;
      if (ctx.isDev() || s === 'connected' || s === 'failed') {
        rtcFlow('pc.connectionState', { state: s, ice: peer.iceConnectionState, signaling: peer.signalingState });
      }
      if (s === 'connected') {
        syncReceiverTracksToRemoteVideo(peer, 'pc.connected');
        const el = ctx.remoteVideo.value;
        if (el?.srcObject instanceof MediaStream) {
          const ms = el.srcObject;
          rtcFlow('ctx.remoteVideo.play.retry', {
            videoTracks: ms.getVideoTracks().length,
            audioTracks: ms.getAudioTracks().length
          });
          void el.play().catch((err: unknown) => {
            if (isBenignVideoPlayAbort(err)) return;
            console.error('[WebRTC] remote video play() on connected failed', err);
          });
        }
      }
      // `disconnected` is often brief during ICE (e.g. right after answer); only `failed` is a hard error.
      if (s === 'failed') {
        console.error('[WebRTC] RTCPeerConnection.connectionState', s, peer.iceConnectionState);
        if (!iceServerListHasTurn(getIceServersFromEnv(ctx.getEnv() as Record<string, unknown>))) {
          console.warn(
            '[WebRTC] Connection failed with STUN-only ICE. Different networks/NATs usually need TURN. Set VITE_ICE_SERVERS_JSON (see frontend-hospital/.env).'
          );
        }
      }
    };
    peer.oniceconnectionstatechange = () => {
      const s = peer.iceConnectionState;
      const hasTurn = iceServerListHasTurn(getIceServersFromEnv(ctx.getEnv() as Record<string, unknown>));
      if (ctx.isDev() || s === 'connected' || s === 'failed') {
        rtcFlow('pc.iceConnectionState', { state: s, connection: peer.connectionState, hasTurn });
      }
      if (s === 'failed') {
        console.error('[WebRTC] RTCPeerConnection.iceConnectionState', s, peer.connectionState);
        if (!hasTurn) {
          console.warn(
            '[WebRTC] ICE failed without TURN in VITE_ICE_SERVERS_JSON — remote video will stay black across many real networks.'
          );
        }
      }
      if (
        s === 'disconnected' &&
        peer.signalingState === 'stable' &&
        peer.connectionState === 'disconnected' &&
        !hasTurn &&
        !iceDisconnectedStableWarned.has(peer)
      ) {
        iceDisconnectedStableWarned.add(peer);
        console.warn(
          '[WebRTC] ICE disconnected while signaling is stable (STUN-only). If this persists, configure TURN via VITE_ICE_SERVERS_JSON.'
        );
      }
    };
  }

  async function startAsCaller(id: string) {
    if (negotiatedForCallId.value === id && pc.value?.localDescription?.type === 'offer') {
      rtcFlow('startAsCaller.skip', { id, reason: 'already-offer-for-call' });
      return;
    }
    negotiatedForCallId.value = id;
    appliedRemoteAnswer.value = false;
    lastIceProcessedLength.value = 0;

    try {
      rtcFlow('startAsCaller.begin', { id });
      const stream = await ensureLocalMedia();
      if (!ctx.sessionActive.value) {
        rtcFlow('startAsCaller.abort.inactive', { id });
        negotiatedForCallId.value = null;
        return;
      }
      pc.value?.close();
      const peer = new RTCPeerConnection(rtcPeerConnectionConfig());
      if (!ctx.sessionActive.value) {
        peer.close();
        negotiatedForCallId.value = null;
        return;
      }
      pc.value = peer;

      stream.getTracks().forEach((t) => peer.addTrack(t, stream));

      bindRemoteStream(peer);

      peer.onicecandidate = (ev) => {
        if (!ev.candidate || !id) return;
        ctx.publishSignal('ice', id, { candidate: ev.candidate.toJSON() });
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!ctx.sessionActive.value) {
        rtcFlow('startAsCaller.abort.afterSetLocal', { id });
        void releasePeer();
        return;
      }
      if (!offer.sdp) {
        console.error('[WebRTC] startAsCaller: createOffer returned empty sdp');
        return;
      }
      ctx.publishSignal('offer', id, { sdp: offer.sdp, type: offer.type });
      rtcFlow('startAsCaller.offerPublished', {
        id,
        signalingState: peer.signalingState,
        sdpBytes: offer.sdp?.length ?? 0
      });
    } catch (err: unknown) {
      console.error('[WebRTC] startAsCaller failed', { id, err });
      throw err;
    }
  }

  async function startAsCallee(id: string, desc: { type?: string; sdp?: string }) {
    const rawSdp = typeof desc.sdp === 'string' ? desc.sdp : '';
    if (!rawSdp) {
      console.error('[WebRTC] startAsCallee skipped: empty remote sdp', { id, desc });
      return;
    }
    const sdpNorm = normalizeWebRtcSdp(rawSdp);
    if (negotiatedForCallId.value === id && pc.value?.localDescription?.type === 'answer') {
      rtcFlow('startAsCallee.skip', { id, reason: 'already-answer-for-call' });
      return;
    }
    negotiatedForCallId.value = id;
    appliedRemoteAnswer.value = false;
    lastIceProcessedLength.value = 0;

    try {
      rtcFlow('startAsCallee.begin', { id, remoteType: desc.type ?? 'offer', sdpBytes: sdpNorm.length });
      const stream = await ensureLocalMedia();
      if (!ctx.sessionActive.value) {
        rtcFlow('startAsCallee.abort.inactive', { id });
        negotiatedForCallId.value = null;
        return;
      }
      pc.value?.close();
      const peer = new RTCPeerConnection(rtcPeerConnectionConfig());
      if (!ctx.sessionActive.value) {
        peer.close();
        negotiatedForCallId.value = null;
        return;
      }
      pc.value = peer;

      stream.getTracks().forEach((t) => peer.addTrack(t, stream));

      bindRemoteStream(peer);

      peer.onicecandidate = (ev) => {
        if (!ev.candidate || !id) return;
        ctx.publishSignal('ice', id, { candidate: ev.candidate.toJSON() });
      };

      const typ = (desc.type ?? 'offer') as RTCSdpType;
      await peer.setRemoteDescription(new RTCSessionDescription({ type: typ, sdp: sdpNorm }));
      if (!ctx.sessionActive.value) {
        rtcFlow('startAsCallee.abort.afterSetRemote', { id });
        void releasePeer();
        return;
      }
      rtcFlow('startAsCallee.remoteOfferApplied', { id, signalingState: peer.signalingState });
      const answer = await peer.createAnswer();
      if (!ctx.sessionActive.value) {
        rtcFlow('startAsCallee.abort.afterCreateAnswer', { id });
        void releasePeer();
        return;
      }
      await peer.setLocalDescription(answer);
      if (!answer.sdp) {
        console.error('[WebRTC] startAsCallee: createAnswer returned empty sdp');
        return;
      }
      ctx.publishSignal('answer', id, { sdp: answer.sdp, type: answer.type });
      rtcFlow('startAsCallee.answerPublished', {
        id,
        signalingState: peer.signalingState,
        sdpBytes: answer.sdp?.length ?? 0
      });
      await drainIceQueue(peer);
      syncReceiverTracksToRemoteVideo(peer, 'callee.afterDrainIce');
      queueMicrotask(() => syncReceiverTracksToRemoteVideo(peer, 'callee.microtask'));
    } catch (err: unknown) {
      console.error('[WebRTC] startAsCallee failed', { id, descType: desc.type, err });
      throw err;
    }
  }

  async function watchCallDeepHandler(c: Record<string, unknown>) {
    if (!ctx.sessionActive.value) {
      if (ctx.isDev()) {
        rtcFlow('watch.call.skip', { reason: 'sessionInactive' });
      }
      return;
    }

        const id = String(c.callId ?? '').trim();
        const outgoing = Boolean(String(c.inviteToUserId ?? '').trim());
        const sig = String(c.lastSignalType ?? '').trim();
        const sigNorm = sig.toLowerCase();
        const remoteDesc = c.webrtcRemoteDescription as { type?: string; sdp?: string } | undefined;
        const remoteTypNorm = String(remoteDesc?.type ?? '').trim().toLowerCase();
        const session = (ctx.appStore.getData(ctx.pkg.value, 'AuthSession') ?? {}) as Record<string, unknown>;
        const myUserId = String(session.userId ?? '').trim();
        const fromUserId = String(c.fromUserId ?? '').trim();
        /**
         * Use stored SDP type, not `lastSignalType`: after Accept the server sends `accept` and the UI
         * overwrites `lastSignalType`, so a callee who opens the popup late would never see `sig === 'offer'`
         * and would skip `setRemoteDescription` entirely (black remote).
         *
         * Do **not** require `fromUserId !== myUserId`: every later STOMP frame (e.g. `accept`) merges
         * `fromUserId` as the **sender of that frame** (often the accepter = self), which makes the old
         * check false even though `webrtcRemoteDescription` is still the peer's offer. Callee = we did
         * not place this session's outbound invite (`!outgoing`).
         *
         * If the peer already applied this offer + our answer, do not treat as a new incoming offer
         * (avoids calling `startAsCallee` every tick while Pinia still holds the offer SDP).
         */
        const peerSnapshot = pc.value;
        const peerAlive =
          peerSnapshot != null &&
          peerSnapshot.connectionState !== 'closed' &&
          peerSnapshot.connectionState !== 'failed';
        const alreadyCalleeNegotiated =
          Boolean(id) &&
          negotiatedForCallId.value === id &&
          peerAlive &&
          peerSnapshot.remoteDescription?.type === 'offer' &&
          peerSnapshot.localDescription?.type === 'answer';
        /** Inbound offer may arrive before the callee taps Accept; do not attach remote media until then. */
        const calleeAccepted =
          Boolean(c.webrtcCalleeAccepted) || sigNorm === 'accept';
        const incomingOffer =
          remoteTypNorm === 'offer' &&
          Boolean(remoteDesc?.sdp) &&
          Boolean(myUserId) &&
          !outgoing &&
          !alreadyCalleeNegotiated &&
          calleeAccepted;
    
        if (
          ctx.isDev() &&
          remoteTypNorm === 'offer' &&
          !outgoing &&
          !Boolean(remoteDesc?.sdp) &&
          !alreadyCalleeNegotiated
        ) {
          console.warn('[WebRTC] offer type in store but sdp missing; cannot run startAsCallee', { id });
        }
    
        if (!id) return;
    
        try {
          if (ctx.isDev()) {
            rtcFlow('watch.call.tick', {
              id,
              outgoing,
              lastSignal: sigNorm,
              calleeAccepted,
              incomingOffer,
              remoteTypNorm,
              alreadyCalleeNegotiated,
              sdpStoreLen: typeof remoteDesc?.sdp === 'string' ? remoteDesc.sdp.length : 0,
              fromUserId: fromUserId || null,
              toUserId: String(c.toUserId ?? '').trim() || null,
              appliedRemoteAnswer: appliedRemoteAnswer.value,
              iceInboundLen: Array.isArray(c.webrtcIceInbound) ? c.webrtcIceInbound.length : 0,
              peerLocal: peerSnapshot?.localDescription?.type ?? null,
              peerRemote: peerSnapshot?.remoteDescription?.type ?? null,
              peerConnection: peerSnapshot?.connectionState ?? null,
              peerAlive
            });
          }
    
          // Outgoing appointment / dashboard call: we chose inviteToUserId; first invite echo includes callId.
          if (outgoing && sigNorm === 'invite') {
            rtcFlow('watch.branch.startAsCaller', { id });
            await startAsCaller(id);
          }
    
          if (incomingOffer) {
            rtcFlow('watch.branch.startAsCallee', { id, fromUserId });
            await startAsCallee(id, remoteDesc!);
          }
    
          const peer = pc.value;
          if (!peer) {
            if (incomingOffer || (outgoing && sigNorm === 'invite')) {
              console.error('[WebRTC] watch: peer is null after startAsCaller/Callee', {
                id,
                outgoing,
                sigNorm,
                incomingOffer
              });
            }
            return;
          }
    
          /**
           * Caller must apply the peer's answer from `webrtcRemoteDescription`. Do not gate on
           * `lastSignalType === 'answer'`: the next STOMP frame is often `accept`, which overwrites
           * `lastSignalType` and would skip `setRemoteDescription` forever (remote video stays black).
           *
           * `watch(call, { deep: true })` can overlap: a second run may execute while the first already
           * applied the answer (`signalingState === 'stable'`). Only apply in `have-local-offer`, and
           * treat an existing remote answer as success.
           */
          if (
            outgoing &&
            remoteTypNorm === 'answer' &&
            Boolean(remoteDesc?.sdp) &&
            !appliedRemoteAnswer.value
          ) {
            try {
              if (peer.remoteDescription?.type === 'answer') {
                if (ctx.isDev()) {
                  rtcFlow('watch.applyAnswer.alreadyApplied', { id, signalingState: peer.signalingState });
                }
                appliedRemoteAnswer.value = true;
              } else if (peer.signalingState !== 'have-local-offer') {
                if (ctx.isDev()) {
                  rtcFlow('watch.applyAnswer.skip', {
                    id,
                    reason: 'not-have-local-offer',
                    signalingState: peer.signalingState,
                    localDesc: peer.localDescription?.type ?? null,
                    storeRemoteTyp: remoteTypNorm
                  });
                }
              } else {
                const rd = remoteDesc!;
                const typ = (rd.type ?? 'answer') as RTCSdpType;
                const answerSdp = typeof rd.sdp === 'string' ? normalizeWebRtcSdp(rd.sdp) : '';
                if (!answerSdp) {
                  console.error('[WebRTC] setRemoteDescription(answer) skipped: empty sdp', { id });
                } else {
                  rtcFlow('watch.applyAnswer.setRemote', { id, sdpBytes: answerSdp.length });
                  await peer.setRemoteDescription(new RTCSessionDescription({ type: typ, sdp: answerSdp }));
                  appliedRemoteAnswer.value = true;
                  rtcFlow('watch.applyAnswer.done', { id, signalingState: peer.signalingState });
                  syncReceiverTracksToRemoteVideo(peer, 'caller.afterAnswer');
                  queueMicrotask(() => syncReceiverTracksToRemoteVideo(peer, 'caller.afterAnswer.microtask'));
                }
              }
            } catch (err: unknown) {
              if (peer.remoteDescription?.type === 'answer') {
                if (ctx.isDev()) {
                  rtcFlow('watch.applyAnswer.recoveredAfterError', { id });
                }
                appliedRemoteAnswer.value = true;
              } else {
                console.error('[WebRTC] setRemoteDescription(answer) failed', {
                  err,
                  signalingState: peer.signalingState,
                  localDesc: peer.localDescription?.type,
                  remoteTypNorm,
                  sdpLen: remoteDesc?.sdp?.length ?? 0
                });
              }
            }
          } else if (outgoing && remoteDesc?.sdp && remoteTypNorm !== 'answer' && remoteTypNorm !== 'offer') {
            console.error('[WebRTC] unexpected webrtcRemoteDescription.type for outgoing call', {
              remoteTypNorm,
              lastSignalType: sigNorm,
              sdpLen: remoteDesc.sdp.length
            });
          }
    
          await drainIceQueue(peer);
          syncReceiverTracksToRemoteVideo(peer, 'watch.afterDrainIce');
        } catch (err: unknown) {
          console.error('[WebRTC] watch(call) failed', {
            err,
            id,
            outgoing,
            lastSignalType: sigNorm,
            remoteTypNorm,
            incomingOffer,
            hasRemoteSdp: Boolean(remoteDesc?.sdp)
          });
        }
    
  }

  let stopCallId: WatchStopHandle | undefined;
  let stopCallDeep: WatchStopHandle | undefined;
  /**
   * Pinia can emit multiple deep updates while an async handler is still awaiting (e.g. `getUserMedia`
   * during `startAsCallee`). A second concurrent run may `close()` the in-flight RTCPeerConnection and
   * leave the call stuck (remote tile black, logs show a lone `answerPublished`).
   */
  let callDeepSerial: Promise<void> = Promise.resolve();

  function mount() {
    if (stopCallId || stopCallDeep) return;
    stopCallId = watch(
      () => ctx.callId.value,
      (id, prev) => {
        if (prev && id && prev !== id) {
          rtcFlow('watch.callId.changed', { prevCallId: prev, nextCallId: id });
          void releasePeer();
        }
        if (prev && !id) {
          rtcFlow('watch.callId.cleared', { prevCallId: prev });
          void releasePeer();
        }
      }
    );
    stopCallDeep = watch(
      ctx.call,
      (c) => {
        callDeepSerial = callDeepSerial
          .then(() => watchCallDeepHandler(c))
          .catch((err: unknown) => {
            console.error('[WebRTC] watch(call) serial failure', err);
          });
      },
      { deep: true }
    );
  }

  function unmount() {
    ctx.sessionActive.value = false;
    stopCallId?.();
    stopCallDeep?.();
    stopCallId = undefined;
    stopCallDeep = undefined;
    callDeepSerial = Promise.resolve();
    void releasePeer({ clearStoredRemoteDescription: true });
  }

  return { mediaError, mount, unmount };
}
