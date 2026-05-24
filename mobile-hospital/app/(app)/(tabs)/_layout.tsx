import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppHeaderBrand } from '@/components/AppHeaderBrand';
import { UserHeaderButton } from '@/components/UserHeaderButton';
import { useSessionStore } from '@/auth/sessionStore';
import { tabIcon } from '@/navigation/tabIcons';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const { t } = useTranslation();
  const role = String(useSessionStore((s) => s.user?.role ?? 'PATIENT')).toUpperCase();
  const isDoctor = role === 'DOCTOR' || role === 'ADMIN';
  const isLoggedIn = useSessionStore((s) => Boolean(s.accessToken));

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitle: () => <AppHeaderBrand />,
        headerTitleAlign: 'left',
        headerRight: () => (isLoggedIn ? <UserHeaderButton /> : null),
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11 }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'home' : 'home-outline', focused)
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t('nav.dashboard'),
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'calendar' : 'calendar-outline', focused)
        }}
      />
      <Tabs.Screen
        name="prescriptions"
        options={{
          title: t('nav.prescriptions'),
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'document-text' : 'document-text-outline', focused)
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: t('nav.blog'),
          href: isDoctor ? null : undefined,
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'newspaper' : 'newspaper-outline', focused)
        }}
      />
      <Tabs.Screen
        name="ai-diagnosis"
        options={{
          title: t('nav.aiDiagnosis'),
          href: isDoctor ? undefined : null,
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'medkit' : 'medkit-outline', focused)
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'person' : 'person-outline', focused)
        }}
      />
    </Tabs>
  );
}
