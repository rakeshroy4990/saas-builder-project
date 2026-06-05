import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

import { authenticateForAppUnlock } from '@/auth/biometricPreferences';
import { useBiometricLockStore } from '@/auth/biometricLockStore';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';

type Props = {
  children: ReactNode;
};

/**
 * Optional app re-entry lock (Face ID / fingerprint) after the app was backgrounded.
 */
export function BiometricAppLock({ children }: Props) {
  const { t } = useTranslation();
  const authenticated = useSessionStore((s) => Boolean(s.accessToken));
  const lockEnabled = useBiometricLockStore((s) => s.enabled);
  const syncFromStorage = useBiometricLockStore((s) => s.syncFromStorage);
  const [locked, setLocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void syncFromStorage();
  }, [authenticated, syncFromStorage]);

  useEffect(() => {
    if (!authenticated || !lockEnabled) {
      setLocked(false);
      return;
    }

    const onChange = (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (next === 'background' || next === 'inactive') {
        setLocked(true);
        return;
      }
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        setLocked(true);
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [authenticated, lockEnabled]);

  async function onUnlockPress() {
    const ok = await authenticateForAppUnlock();
    if (ok) setLocked(false);
  }

  const showOverlay = authenticated && lockEnabled && locked;

  return (
    <>
      {children}
      {showOverlay ? (
        <View style={styles.overlay} accessibilityViewIsModal>
          <Text style={styles.title}>{t('security.biometricLockTitle')}</Text>
          <Text style={styles.message}>{t('security.biometricLockMessage')}</Text>
          <Pressable style={styles.button} onPress={() => void onUnlockPress()}>
            <Text style={styles.buttonText}>{t('security.biometricUnlock')}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999
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
