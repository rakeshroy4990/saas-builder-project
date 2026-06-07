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

import {
  authenticateForAppUnlock,
  cancelBiometricPrompt
} from '@/auth/biometricPreferences';
import { useBiometricLockStore } from '@/auth/biometricLockStore';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';

const screen = Dimensions.get('screen');

/** Let the lock Modal mount before showing the system biometric sheet. */
const AUTO_PROMPT_DELAY_MS = 300;

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
  const [promptRetryNonce, setPromptRetryNonce] = useState(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lockedRef = useRef(false);
  const promptingRef = useRef(false);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const engageLock = useCallback(() => {
    if (isWithinUnlockGrace()) return;
    if (lockedRef.current) {
      setLocked(true);
      return;
    }
    lockedRef.current = true;
    setLocked(true);
    setLockEpoch((epoch) => epoch + 1);
  }, [isWithinUnlockGrace]);

  const releaseLock = useCallback(() => {
    lockedRef.current = false;
    setLocked(false);
  }, []);

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
      lockedRef.current = false;
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
        void cancelBiometricPrompt();
        promptingRef.current = false;
        engageLock();
        return;
      }

      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        void cancelBiometricPrompt();
        promptingRef.current = false;
        if (lockedRef.current) {
          setPromptRetryNonce((nonce) => nonce + 1);
        } else {
          engageLock();
        }
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [authenticated, lockEnabled, engageLock]);

  const showOverlay = authenticated && lockEnabled && locked;

  useEffect(() => {
    if (!showOverlay) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || promptingRef.current) return;
        promptingRef.current = true;
        try {
          const ok = await authenticateForAppUnlock();
          if (!cancelled && ok) releaseLock();
        } finally {
          promptingRef.current = false;
        }
      })();
    }, AUTO_PROMPT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void cancelBiometricPrompt();
      promptingRef.current = false;
    };
  }, [showOverlay, lockEpoch, promptRetryNonce, releaseLock]);

  async function onUnlockPress() {
    void cancelBiometricPrompt();
    promptingRef.current = true;
    try {
      const ok = await authenticateForAppUnlock();
      if (ok) releaseLock();
    } finally {
      promptingRef.current = false;
    }
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
      <View
        style={[
          styles.backdrop,
          {
            width: screen.width,
            height: screen.height,
            paddingTop: insets.top,
            paddingBottom: insets.bottom
          }
        ]}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <View style={styles.body}>
          <Text style={styles.title}>{t('security.biometricLockTitle')}</Text>
          <Text style={styles.message}>{t('security.biometricLockMessage')}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => void onUnlockPress()}
            accessibilityRole="button"
            accessibilityLabel={t('security.biometricUnlock')}
          >
            <Text style={styles.buttonText}>{t('security.biometricUnlock')}</Text>
          </Pressable>
        </View>
      </View>
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
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center'
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
