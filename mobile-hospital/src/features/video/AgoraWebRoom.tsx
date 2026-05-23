import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import { renewAppointmentCallToken } from './api';
import { buildAgoraWebCallHtml } from './agoraWebCallHtml';
import type { VideoSession } from './types';

export type AgoraWebRoomHandle = {
  join: (session: VideoSession, appointmentId: string) => void;
  leave: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setCamEnabled: (enabled: boolean) => void;
  switchCamera: () => void;
};

type AgoraWebRoomProps = {
  onJoined?: () => void;
  onRemoteJoined?: () => void;
  onRemoteLeft?: () => void;
  onError?: (message: string) => void;
  onLeft?: () => void;
};

type WebOutbound =
  | { command: 'join'; appId: string; channel: string; token: string; uid: number }
  | { command: 'leave' }
  | { command: 'setMic'; enabled: boolean }
  | { command: 'setCam'; enabled: boolean }
  | { command: 'switchCamera' }
  | { command: 'renewToken'; token: string };

let activeRoom: AgoraWebRoomHandle | null = null;

export function registerActiveAgoraWebRoom(room: AgoraWebRoomHandle | null): void {
  activeRoom = room;
}

export async function releaseAgoraWebRoom(): Promise<void> {
  activeRoom?.leave();
}

export const AgoraWebRoom = forwardRef<AgoraWebRoomHandle, AgoraWebRoomProps>(function AgoraWebRoom(
  { onJoined, onRemoteJoined, onRemoteLeft, onError, onLeft },
  ref
) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<WebOutbound[]>([]);
  const appointmentIdRef = useRef('');

  const postCommand = useCallback((cmd: WebOutbound) => {
    if (!readyRef.current) {
      pendingRef.current.push(cmd);
      return;
    }
    webRef.current?.postMessage(JSON.stringify(cmd));
  }, []);

  useEffect(() => {
    registerActiveAgoraWebRoom({
      join: (session, appointmentId) => {
        appointmentIdRef.current = appointmentId;
        postCommand({
          command: 'join',
          appId: session.appId,
          channel: session.roomId,
          token: session.token,
          uid: session.uid
        });
      },
      leave: () => postCommand({ command: 'leave' }),
      setMicEnabled: (enabled) => postCommand({ command: 'setMic', enabled }),
      setCamEnabled: (enabled) => postCommand({ command: 'setCam', enabled }),
      switchCamera: () => postCommand({ command: 'switchCamera' })
    });
    return () => registerActiveAgoraWebRoom(null);
  }, [postCommand]);

  useImperativeHandle(ref, () => ({
    join: (session, appointmentId) => {
      appointmentIdRef.current = appointmentId;
      postCommand({
        command: 'join',
        appId: session.appId,
        channel: session.roomId,
        token: session.token,
        uid: session.uid
      });
    },
    leave: () => postCommand({ command: 'leave' }),
    setMicEnabled: (enabled) => postCommand({ command: 'setMic', enabled }),
    setCamEnabled: (enabled) => postCommand({ command: 'setCam', enabled }),
    switchCamera: () => postCommand({ command: 'switchCamera' })
  }));

  const flushPending = useCallback(() => {
    readyRef.current = true;
    for (const cmd of pendingRef.current) {
      webRef.current?.postMessage(JSON.stringify(cmd));
    }
    pendingRef.current = [];
  }, []);

  const onWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as { type?: string; message?: string };
        switch (msg.type) {
          case 'ready':
            flushPending();
            break;
          case 'joined':
            onJoined?.();
            break;
          case 'remoteJoined':
            onRemoteJoined?.();
            break;
          case 'remoteLeft':
            onRemoteLeft?.();
            break;
          case 'left':
            onLeft?.();
            break;
          case 'error':
            onError?.(String(msg.message ?? 'Video error'));
            break;
          case 'tokenWillExpire':
            void (async () => {
              const appt = appointmentIdRef.current;
              if (!appt) return;
              try {
                const token = await renewAppointmentCallToken(appt);
                if (token) {
                  postCommand({ command: 'renewToken', token });
                }
              } catch {
                onError?.('Token renew failed');
              }
            })();
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed web messages
      }
    },
    [flushPending, onError, onJoined, onLeft, onRemoteJoined, onRemoteLeft, postCommand]
  );

  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        style={styles.fill}
        originWhitelist={['*']}
        source={{ html: buildAgoraWebCallHtml(), baseUrl: 'https://localhost' }}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaCapturePermissionGrantType="grant"
        onMessage={onWebMessage}
        {...(Platform.OS === 'android'
          ? {
              androidLayerType: 'hardware' as const,
              mixedContentMode: 'always' as const
            }
          : {})}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#1e293b' }
});
