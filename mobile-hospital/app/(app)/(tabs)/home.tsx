import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { HomeContentSections } from '@/components/home/HomeContentSections';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { buildHomeContent } from '@/features/home/homeContent';
import { fetchPublicHeroVideoId } from '@/features/home/youtubeHero';
import { openMainTab } from '@/navigation/openTab';
import { sharedStyles } from '@/theme/styles';

export default function HomeTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const accessToken = useSessionStore((s) => s.accessToken);
  const isLoggedIn = Boolean(accessToken);
  const isDoctor = String(user?.role ?? '').toUpperCase() === 'DOCTOR' || String(user?.role ?? '').toUpperCase() === 'ADMIN';
  const [videoId, setVideoId] = useState<string | null>(null);
  const content = useMemo(() => buildHomeContent(t, isDoctor), [t, isDoctor]);

  useEffect(() => {
    (async () => {
      try {
        const id = await fetchPublicHeroVideoId();
        setVideoId(id);
      } catch {
        setVideoId(null);
      }
    })();
  }, []);

  function onHeroCta() {
    if (isDoctor) {
      openMainTab('ai-diagnosis');
      return;
    }
    if (isLoggedIn) {
      openMainTab('appointments');
      return;
    }
    router.push('/(auth)/login');
  }

  return (
    <ScrollView style={sharedStyles.screenPadded} contentContainerStyle={{ paddingBottom: 88 }}>
      <Text style={sharedStyles.title}>{content.hero.title}</Text>
      {isLoggedIn ? (
        <Text style={[sharedStyles.subtitle, { marginBottom: 12 }]}>
          {t('dashboard.welcome', { name: user?.displayName ?? '' })}
        </Text>
      ) : null}
      <Text style={sharedStyles.subtitle}>{content.hero.subtitle}</Text>

      <YouTubeEmbed videoId={videoId} title={t('home.hero.featuredVideoTitle')} />

      <Pressable style={[sharedStyles.button, { marginTop: 20 }]} onPress={onHeroCta}>
        <Text style={sharedStyles.buttonText}>{content.hero.ctaPrimary}</Text>
      </Pressable>

      <HomeContentSections content={content} />

      {!isLoggedIn ? (
        <Pressable style={[sharedStyles.buttonSecondary, { marginTop: 8 }]} onPress={() => router.push('/(auth)/login')}>
          <Text style={sharedStyles.buttonSecondaryText}>{t('auth.signIn')}</Text>
        </Pressable>
      ) : (
        <Text style={[sharedStyles.subtitle, { marginTop: 20, textAlign: 'center' }]}>
          {t('home.useBottomNav')}
        </Text>
      )}
      {!isLoggedIn ? (
        <Text style={[sharedStyles.subtitle, { marginTop: 8, textAlign: 'center' }]}>{t('home.publicWelcome')}</Text>
      ) : null}
    </ScrollView>
  );
}
