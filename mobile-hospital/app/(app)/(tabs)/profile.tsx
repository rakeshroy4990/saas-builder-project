import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { pickString } from '@saas-builder/hospital-api-client';

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

  if (loading) {
    return <LoadingView />;
  }

  const email = pickString(profile ?? {}, ['EmailId', 'emailId', 'Email', 'email']) || user?.email || '';
  const mobile = pickString(profile ?? {}, ['MobileNumber', 'mobileNumber']);

  return (
    <ScrollView style={sharedStyles.screenPadded}>
      <View style={[sharedStyles.card, { marginTop: 8 }]}>
        <Text style={sharedStyles.label}>{t('profile.email')}</Text>
        <Text style={{ fontSize: 16, color: colors.text }}>{email}</Text>
        {mobile ? (
          <>
            <Text style={[sharedStyles.label, { marginTop: 12 }]}>Mobile</Text>
            <Text style={{ fontSize: 16, color: colors.text }}>{mobile}</Text>
          </>
        ) : null}
        <Text style={[sharedStyles.label, { marginTop: 12 }]}>{t('profile.userId')}</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{user?.userId}</Text>
      </View>

      <Pressable style={[sharedStyles.buttonSecondary, { marginTop: 24 }]} onPress={() => void onSignOut()}>
        <Text style={sharedStyles.buttonSecondaryText}>{t('nav.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}
