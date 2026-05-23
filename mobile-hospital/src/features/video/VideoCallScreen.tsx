import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgoraWebRoom, type AgoraWebRoomHandle } from '@/features/video/AgoraWebRoom';
import {
  clearCallHeartbeatTimer,
  publishCallAccept,
  startCallHeartbeat
} from '@/features/video/callSignals';
import {
  rejectIncomingCall,
  startOutgoingCall,
  teardownCall
} from '@/features/video/callLifecycle';
import { ensureCallPermissions } from '@/features/video/permissions';
import { prepareVideoSession } from '@/features/video/prepareVideoSession';
import { useVideoCallStore } from '@/features/video/videoCallStore';

export function VideoCallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webRoomRef = useRef<AgoraWebRoomHandle>(null);
  const call = useVideoCallStore();
  const stompCallId = useVideoCallStore((s) => s.callId);
  const prevCallIdRef = useRef(stompCallId);
  const [remoteVisible, setRemoteVisible] = useState(false);
  const [phase, setPhase] = useState<'ringing' | 'connecting' | 'in_call' | 'error'>('connecting');
  const [errorText, setErrorText] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const showAccept = useMemo(() => {
    if (!call.callId) return false;
    if (call.inviteToUserId) return false;
    const s = call.lastSignalType.trim().toLowerCase();
    if (s === 'accept' || s === 'reject' || s === 'end') return false;
    return call.incomingRing || !call.videoCallOutgoingInvite;
  }, [call.callId, call.inviteToUserId, call.lastSignalType, call.incomingRing, call.videoCallOutgoingInvite]);

  const isOutgoing = call.videoCallOutgoingInvite;
  const showWebRtc = phase !== 'ringing';

  const joinFromSession = useCallback(async () => {
    const session = useVideoCallStore.getState().videoSession;
    const appointmentId = String(useVideoCallStore.getState().inviteAppointmentId ?? '').trim();
    if (!session || !appointmentId) {
      throw new Error(t('video.errorSession'));
    }
    const permitted = await ensureCallPermissions();
    if (!permitted) {
      throw new Error(t('video.errorPermissions'));
    }
    webRoomRef.current?.join(session, appointmentId);
  }, [t]);

  useEffect(() => {
    if (phase === 'in_call' && stompCallId) {
      startCallHeartbeat(stompCallId);
      return () => clearCallHeartbeatTimer();
    }
    return undefined;
  }, [phase, stompCallId]);

  useEffect(() => {
    void activateKeepAwakeAsync('video-call');
    return () => {
      deactivateKeepAwake('video-call');
    };
  }, []);

  useEffect(() => {
    if (showAccept) {
      setPhase('ringing');
      return;
    }
    if (!isOutgoing) {
      return;
    }
    let cancelled = false;
    (async () => {
      setPhase('connecting');
      try {
        await startOutgoingCall();
        if (cancelled) return;
        await joinFromSession();
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : t('video.errorJoin');
        setErrorText(msg);
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOutgoing, showAccept, joinFromSession, t]);

  const handleAccept = async () => {
    setPhase('connecting');
    try {
      const callId = useVideoCallStore.getState().callId;
      if (callId) {
        await publishCallAccept(callId);
      }
      useVideoCallStore.getState().patch({ incomingRing: false, webrtcCalleeAccepted: true });
      const ok = await prepareVideoSession();
      if (!ok) {
        throw new Error(t('video.errorSession'));
      }
      await joinFromSession();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('video.errorJoin');
      setErrorText(msg);
      setPhase('error');
    }
  };

  const handleReject = async () => {
    await rejectIncomingCall();
    router.back();
  };

  const handleEnd = async () => {
    webRoomRef.current?.leave();
    await teardownCall();
    router.back();
  };

  useEffect(() => {
    if (prevCallIdRef.current && !stompCallId) {
      webRoomRef.current?.leave();
      router.back();
    }
    prevCallIdRef.current = stompCallId;
  }, [stompCallId, router]);

  useEffect(() => {
    return () => {
      webRoomRef.current?.leave();
    };
  }, []);

  const partyName = call.remotePartyName || t('video.remoteParty');

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Text style={styles.title}>{partyName}</Text>
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

      {phase === 'ringing' ? (
        <View style={styles.center}>
          <Text style={styles.subtitle}>{t('video.incoming')}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.accept]} onPress={() => void handleAccept()}>
              <Text style={styles.btnText}>{t('video.accept')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.reject]} onPress={() => void handleReject()}>
              <Text style={styles.btnText}>{t('video.reject')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showWebRtc ? (
        <View style={styles.videoArea}>
          <AgoraWebRoom
            ref={webRoomRef}
            onJoined={() => {
              setPhase('in_call');
              setErrorText('');
            }}
            onRemoteJoined={() => setRemoteVisible(true)}
            onRemoteLeft={() => setRemoteVisible(false)}
            onError={(message) => {
              setErrorText(message);
              setPhase('error');
            }}
          />
          {phase === 'connecting' ? (
            <View style={styles.connectingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.subtitle}>{t('video.connecting')}</Text>
            </View>
          ) : null}
          {phase === 'in_call' && !remoteVisible ? (
            <View style={styles.connectingOverlay}>
              <Text style={styles.subtitle}>{t('video.waitingRemote')}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase !== 'ringing' ? (
        <View style={styles.controls}>
          <Pressable
            style={styles.controlBtn}
            onPress={() => {
              const next = !micOn;
              setMicOn(next);
              webRoomRef.current?.setMicEnabled(next);
            }}
          >
            <Text style={styles.controlText}>{micOn ? t('video.muteMic') : t('video.unmuteMic')}</Text>
          </Pressable>
          <Pressable
            style={styles.controlBtn}
            onPress={() => {
              const next = !camOn;
              setCamOn(next);
              webRoomRef.current?.setCamEnabled(next);
            }}
          >
            <Text style={styles.controlText}>{camOn ? t('video.camOff') : t('video.camOn')}</Text>
          </Pressable>
          <Pressable style={styles.controlBtn} onPress={() => webRoomRef.current?.switchCamera()}>
            <Text style={styles.controlText}>{t('video.flip')}</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, styles.endBtn]} onPress={() => void handleEnd()}>
            <Text style={styles.controlText}>{t('video.end')}</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'error' ? (
        <Pressable style={[styles.btn, styles.reject, { alignSelf: 'center' }]} onPress={() => void handleEnd()}>
          <Text style={styles.btnText}>{t('video.close')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 12
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8
  },
  error: {
    color: '#fca5a5',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 8
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10
  },
  accept: {
    backgroundColor: '#16a34a'
  },
  reject: {
    backgroundColor: '#dc2626'
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  videoArea: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    padding: 12
  },
  controlBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8
  },
  endBtn: {
    backgroundColor: '#dc2626'
  },
  controlText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600'
  }
});
