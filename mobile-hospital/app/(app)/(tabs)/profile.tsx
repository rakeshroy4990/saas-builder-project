import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { pickString } from '@saas-builder/hospital-api-client';

import {
  authenticateForAppUnlock,
  isBiometricHardwareAvailable,
  setBiometricLockEnabled
} from '@/auth/biometricPreferences';
import { useBiometricLockStore } from '@/auth/biometricLockStore';
import { AuthGate } from '@/components/AuthGate';
import { useSessionStore } from '@/auth/sessionStore';
import { LoadingView } from '@/components/LoadingView';
import { fetchUserProfile, logout } from '@/features/auth/api';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

export default function ProfileTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const biometricEnabled = useBiometricLockStore((s) => s.enabled);
  const syncBiometric = useBiometricLockStore((s) => s.syncFromStorage);
  const setBiometricEnabled = useBiometricLockStore((s) => s.setEnabled);
  const grantUnlockGrace = useBiometricLockStore((s) => s.grantUnlockGrace);

  useEffect(() => {
    void (async () => {
      const hardware = await isBiometricHardwareAvailable();
      setBiometricAvailable(hardware);
      await syncBiometric();
    })();
  }, [syncBiometric]);

  useEffect(() => {
    if (!user?.userId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const row = await fetchUserProfile(user.userId);
        setProfile(row);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.userId]);

  async function onBiometricToggle(next: boolean) {
    if (next) {
      if (!(await isBiometricHardwareAvailable())) return;
      if (!(await authenticateForAppUnlock())) return;
      grantUnlockGrace();
    }
    await setBiometricLockEnabled(next);
    setBiometricEnabled(next);
  }

  async function onSignOut() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <AuthGate>
      {loading ? (
        <LoadingView />
      ) : (
        <ScrollView style={sharedStyles.screenPadded}>
          <View style={[sharedStyles.card, { marginTop: 8 }]}>
            {user?.displayName?.trim() ? (
              <>
                <Text style={sharedStyles.label}>{t('profile.name')}</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>{user.displayName}</Text>
              </>
            ) : null}
            <Text style={[sharedStyles.label, { marginTop: user?.displayName?.trim() ? 12 : 0 }]}>{t('profile.email')}</Text>
            <Text style={{ fontSize: 16, color: colors.text }}>{pickString(profile ?? {}, ['EmailId', 'emailId', 'Email', 'email']) || user?.email || ''}</Text>
            <Text style={[sharedStyles.label, { marginTop: 12 }]}>{t('profile.role')}</Text>
            <Text style={{ fontSize: 16, color: colors.text }}>{user?.role ?? ''}</Text>
            <Text style={[sharedStyles.label, { marginTop: 12 }]}>{t('profile.userId')}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.userId}</Text>
          </View>

          {biometricAvailable ? (
            <View style={[sharedStyles.card, { marginTop: 16, flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                  {t('security.biometricLockSetting')}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                  {t('security.biometricLockSettingHint')}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={(value) => void onBiometricToggle(value)}
                accessibilityLabel={t('security.biometricLockSetting')}
              />
            </View>
          ) : null}

          <Pressable style={[sharedStyles.buttonSecondary, { marginTop: 24 }]} onPress={() => void onSignOut()}>
            <Text style={sharedStyles.buttonSecondaryText}>{t('nav.signOut')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </AuthGate>
  );
}
