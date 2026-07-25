import { Redirect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthGate } from '@/components/AuthGate';
import { useSessionStore } from '@/auth/sessionStore';
import { AiConversationScreen } from '@/features/aiConversation/AiConversationScreen';

function isDoctorRole(role: string): boolean {
  const normalized = role.trim().toUpperCase();
  return normalized === 'DOCTOR' || normalized === 'ADMIN';
}

export default function AiConversationRoute() {
  const { t } = useTranslation();
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();

  return (
    <AuthGate>
      <Stack.Screen options={{ title: t('aiConversation.title') }} />
      {isDoctorRole(role) ? (
        <AiConversationScreen />
      ) : (
        <Redirect href={'/(app)/(tabs)/home' as never} />
      )}
    </AuthGate>
  );
}
