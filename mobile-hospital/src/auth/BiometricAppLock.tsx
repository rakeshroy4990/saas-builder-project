import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authenticateForAppUnlock } from '@/auth/biometricPreferences';
import { useBiometricLockStore } from '@/auth/biometricLockStore';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';

const screen = Dimensions.get('screen');

/**
 * Full-screen app lock rendered at the root layout so it covers navigation and tabs.
 */
export function BiometricAppLockOverlay() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const authenticated = useSessionStore((s) => Boolean(s.accessToken));
  const lockEnabled = useBiometricLockStore((s) => s.enabled);
  const syncFromStorage = useBiometricLockStore((s) => s.syncFromStorage);
  const isWithinUnlockGrace = useBiometricLockStore((s) => s.isWithinUnlockGrace);
  const [locked, setLocked] = useState(false);
  const [lockEpoch, setLockEpoch] = useState(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const promptingRef = useRef(false);

  const engageLock = useCallback(() => {
    if (isWithinUnlockGrace()) return;
    setLocked(true);
    setLockEpoch((epoch) => epoch + 1);
  }, [isWithinUnlockGrace]);

  useEffect(() => {
    void syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    if (authenticated) {
      void syncFromStorage();
    }
  }, [authenticated, syncFromStorage]);

  useEffect(() => {
    if (!authenticated || !lockEnabled) {
      setLocked(false);
      return;
    }
    engageLock();
  }, [authenticated, lockEnabled, engageLock]);

  useEffect(() => {
    if (!authenticated || !lockEnabled) return;

    const onChange = (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (next === 'background' || next === 'inactive') {
        engageLock();
        return;
      }
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        engageLock();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [authenticated, lockEnabled, engageLock]);

  const showOverlay = authenticated && lockEnabled && locked;

  useEffect(() => {
    if (!showOverlay) return;

    let cancelled = false;
    promptingRef.current = true;

    void (async () => {
      const ok = await authenticateForAppUnlock();
      if (cancelled) return;
      promptingRef.current = false;
      if (ok) setLocked(false);
    })();

    return () => {
      cancelled = true;
      promptingRef.current = false;
    };
  }, [showOverlay, lockEpoch]);

  async function onUnlockPress() {
    if (promptingRef.current) return;
    promptingRef.current = true;
    const ok = await authenticateForAppUnlock();
    promptingRef.current = false;
    if (ok) setLocked(false);
  }

  if (!showOverlay) return null;

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => undefined}
    >
      <Pressable
        style={[
          styles.backdrop,
          {
            width: screen.width,
            height: screen.height,
            paddingTop: insets.top,
            paddingBottom: insets.bottom
          }
        ]}
        onPress={() => void onUnlockPress()}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <View style={styles.body} pointerEvents="box-none">
          <Text style={styles.title}>{t('security.biometricLockTitle')}</Text>
          <Text style={styles.message}>{t('security.biometricLockMessage')}</Text>
          <Pressable style={styles.button} onPress={() => void onUnlockPress()}>
            <Text style={styles.buttonText}>{t('security.biometricUnlock')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 100_000 },
      default: { zIndex: 100_000 }
    })
  },
  body: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 24
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  message: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
