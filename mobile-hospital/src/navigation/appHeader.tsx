import { View } from 'react-native';

import { AppHeaderBrand } from '@/components/AppHeaderBrand';
import { NotificationHeaderButton } from '@/components/NotificationHeaderButton';
import { UserHeaderButton } from '@/components/UserHeaderButton';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';

export function AppHeaderRight() {
  const isLoggedIn = useSessionStore((s) => Boolean(s.accessToken));

  if (!isLoggedIn) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <NotificationHeaderButton />
      <UserHeaderButton />
    </View>
  );
}

/** Logo + brand title on the left; notification and profile on the right when signed in. */
export const appHeaderScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitle: () => <AppHeaderBrand />,
  headerTitleAlign: 'left' as const,
  headerRight: () => <AppHeaderRight />
};
