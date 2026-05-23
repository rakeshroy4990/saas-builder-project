import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { pickString } from '@saas-builder/hospital-api-client';

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

          <Pressable style={[sharedStyles.buttonSecondary, { marginTop: 24 }]} onPress={() => void onSignOut()}>
            <Text style={sharedStyles.buttonSecondaryText}>{t('nav.signOut')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </AuthGate>
  );
}
