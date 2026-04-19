import { nextTick, ref, watch, type Ref, type WatchStopHandle } from 'vue';
import { createBuiltinStompWebRtcRoom } from './builtinStompWebRtcRoom';
import type { BuiltinStompWebRtcContext, BuiltinStompWebRtcRoom } from './builtinStompWebRtcRoom';

export type VideoProviderId = 'builtin' | 'agora' | '100ms' | 'twilio';

export type VideoRoomHostContext = BuiltinStompWebRtcContext;

export type AgoraVideoRoom = {
  mediaError: Ref<string>;
  mount: () => void;
  unmount: () => void;
};

export type VideoRoom = BuiltinStompWebRtcRoom | AgoraVideoRoom;

export function resolveVideoProviderFromEnv(env: Record<string, unknown>): VideoProviderId {
  const v = String(env.VITE_VIDEO_PROVIDER ?? 'builtin').trim().toLowerCase();
  if (v === 'agora') return 'agora';
  if (v === '100ms' || v === 'hms') return '100ms';
  if (v === 'twilio') return 'twilio';
  return 'builtin';
}

function readAgoraSession(call: Record<string, unknown>): Record<string, unknown> | null {
  const raw = call.videoSession ?? call.VideoSession;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

type AgoraRtcModule = {
  createClient: (config: { mode: string; codec: string }) => {
    join: (appId: string, channel: string, token: string | null, uid: number | null) => Promise<void>;
    leave: () => Promise<void>;
    publish: (tracks: unknown) => Promise<void>;
    on: (ev: string, fn: (...args: unknown[]) => void | Promise<void>) => void;
    subscribe: (user: unknown, mediaType: unknown) => Promise<void>;
  };
  createMicrophoneAndCameraTracks: () => Promise<[unknown, unknown]>;
};

function createAgoraVideoRoom(ctx: BuiltinStompWebRtcContext): AgoraVideoRoom {
  const mediaError = ref('');
  let stop: WatchStopHandle | undefined;
  let client: ReturnType<AgoraRtcModule['createClient']> | null = null;
  let localTracks: Array<{ close: () => void; play: (el?: HTMLElement) => void }> = [];
  let joinedKey = '';

  async function leave() {
    joinedKey = '';
    for (const t of localTracks) {
      try {
        t.close();
      } catch {
        // no-op
      }
    }
    localTracks = [];
    if (client) {
      try {
        await client.leave();
      } catch {
        // no-op
      }
      client = null;
    }
    if (ctx.localVideo.value) ctx.localVideo.value.srcObject = null;
    if (ctx.remoteVideo.value) ctx.remoteVideo.value.srcObject = null;
  }

  async function joinFromStore() {
    const call = ctx.call.value;
    const session = readAgoraSession(call);
    if (!session) return;
    const appId = String(session.appId ?? session.AppId ?? '').trim();
    const channel = String(session.roomId ?? session.RoomId ?? '').trim();
    const token = String(session.token ?? session.Token ?? '').trim();
    const uidRaw = session.uid ?? session.Uid;
    const uid =
      typeof uidRaw === 'number' && Number.isFinite(uidRaw)
        ? uidRaw
        : Number.parseInt(String(uidRaw ?? ''), 10) || null;
    if (!appId || !channel || !token || uid == null) {
      return;
    }
    const nextKey = `${appId}|${channel}|${token}|${uid}`;
    if (nextKey === joinedKey) {
      return;
    }
    await leave();
    try {
      const mod = (await import('agora-rtc-sdk-ng')) as unknown as AgoraRtcModule;
      client = mod.createClient({ mode: 'rtc', codec: 'vp8' });
      const c = client;
      c.on('user-published', async (user: unknown, mediaType: unknown) => {
        await c.subscribe(user, mediaType);
        const u = user as { videoTrack?: { play: (el: HTMLElement) => void }; audioTrack?: { play: () => void } };
        if (mediaType === 'video' && u.videoTrack) {
          await nextTick();
          const el = ctx.remoteVideo.value;
          if (el) {
            u.videoTrack.play(el);
          }
        }
        if (mediaType === 'audio' && u.audioTrack) {
          u.audioTrack.play();
        }
      });
      c.on('user-unpublished', () => undefined);
      await c.join(appId, channel, token, uid);
      const mic = (await mod.createMicrophoneAndCameraTracks()) as [
        { close: () => void; play: (el?: HTMLElement) => void },
        { close: () => void; play: (el?: HTMLElement) => void }
      ];
      localTracks = [...mic];
      if (ctx.localVideo.value) {
        mic[1].play(ctx.localVideo.value);
      }
      await c.publish(mic);
      joinedKey = nextKey;
      mediaError.value = '';
    } catch (e: unknown) {
      console.error('[Agora] join failed', e);
      mediaError.value = 'Unable to start Agora video. Check token, App ID, and network.';
      await leave();
    }
  }

  function mount() {
    if (stop) return;
    stop = watch(
      ctx.call,
      () => {
        void joinFromStore();
      },
      { deep: true, immediate: true }
    );
  }

  function unmount() {
    ctx.sessionActive.value = false;
    stop?.();
    stop = undefined;
    void leave();
  }

  return { mediaError, mount, unmount };
}

/**
 * Hospital / shared entry: built-in STOMP + RTCPeerConnection, or a vendor SDK adapter.
 */
export function createVideoRoomAdapter(provider: VideoProviderId, ctx: VideoRoomHostContext): VideoRoom {
  if (provider === 'agora') {
    return createAgoraVideoRoom(ctx);
  }
  if (provider !== 'builtin' && provider !== '100ms' && provider !== 'twilio') {
    if (ctx.isDev()) {
      console.warn('[VideoRoom] unknown VITE_VIDEO_PROVIDER; using builtin', provider);
    }
  }
  if (provider === '100ms' || provider === 'twilio') {
    if (ctx.isDev()) {
      console.warn('[VideoRoom] provider not implemented yet; using builtin WebRTC', provider);
    }
    return createBuiltinStompWebRtcRoom(ctx);
  }
  return createBuiltinStompWebRtcRoom(ctx);
}

export type { BuiltinStompWebRtcContext, BuiltinStompWebRtcRoom } from './builtinStompWebRtcRoom';
