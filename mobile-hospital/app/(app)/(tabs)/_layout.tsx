import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@/auth/sessionStore';
import { appHeaderScreenOptions } from '@/navigation/appHeader';
import { tabIcon } from '@/navigation/tabIcons';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const { t } = useTranslation();
  const role = String(useSessionStore((s) => s.user?.role ?? 'PATIENT')).toUpperCase();
  const isDoctor = role === 'DOCTOR' || role === 'ADMIN';

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        ...appHeaderScreenOptions,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
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
          title: t('nav.prescriptionsShort'),
          tabBarIcon: ({ focused }) => tabIcon(focused ? 'document-text' : 'document-text-outline', focused)
        }}
      />
      <Tabs.Screen name="blog" options={{ href: null }} />
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
