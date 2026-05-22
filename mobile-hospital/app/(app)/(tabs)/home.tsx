import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { sharedStyles } from '@/theme/styles';

type NavTarget = 'appointments' | 'prescriptions' | 'blog' | 'ai-diagnosis' | 'profile';

export default function HomeTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const role = String(user?.role ?? 'PATIENT').toUpperCase();
  const isDoctor = role === 'DOCTOR';

  const items: Array<{ key: NavTarget; label: string; hint: string; icon: string }> = [
    {
      key: 'appointments',
      label: t('nav.dashboard'),
      hint: t('home.cards.appointments'),
      icon: '📅'
    },
    {
      key: 'prescriptions',
      label: t('nav.prescriptions'),
      hint: t('home.cards.prescriptions'),
      icon: '📋'
    },
    ...(isDoctor
      ? [
          {
            key: 'ai-diagnosis' as NavTarget,
            label: t('nav.aiDiagnosis'),
            hint: t('home.cards.aiDiagnosis'),
            icon: '🩺'
          }
        ]
      : [
          {
            key: 'blog' as NavTarget,
            label: t('nav.blog'),
            hint: t('home.cards.blog'),
            icon: '📰'
          }
        ]),
    {
      key: 'profile',
      label: t('nav.profile'),
      hint: t('home.cards.profile'),
      icon: '👤'
    }
  ];

  function open(target: NavTarget) {
    router.push(`/(app)/(tabs)/${target}` as never);
  }

  return (
    <ScrollView style={sharedStyles.screenPadded} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={sharedStyles.title}>{t('home.hero.title')}</Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 8 }]}>
        {t('dashboard.welcome', { name: user?.displayName ?? '' })}
      </Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 20 }]}>{t('home.hero.subtitle')}</Text>

      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <Pressable key={item.key} style={sharedStyles.card} onPress={() => open(item.key)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#0f172a' }}>{item.label}</Text>
                <Text style={sharedStyles.subtitle}>{item.hint}</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#94a3b8' }}>›</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
