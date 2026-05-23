import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);

  if (accessToken) {
    return <>{children}</>;
  }

  return (
    <View style={[sharedStyles.screenPadded, { flex: 1, justifyContent: 'center' }]}>
      <Text style={sharedStyles.title}>{t('auth.gateTitle')}</Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 20 }]}>{t('auth.gateMessage')}</Text>
      <Pressable style={sharedStyles.button} onPress={() => router.push('/(auth)/login')}>
        <Text style={sharedStyles.buttonText}>{t('auth.signIn')}</Text>
      </Pressable>
      <Pressable
        style={[sharedStyles.buttonSecondary, { marginTop: 12 }]}
        onPress={() => {
          useSessionStore.getState().enterGuestMode();
          router.replace('/(app)/(tabs)/home' as never);
        }}
      >
        <Text style={[sharedStyles.buttonSecondaryText, { color: colors.primary }]}>
          {t('auth.skipForNow')}
        </Text>
      </Pressable>
    </View>
  );
}
