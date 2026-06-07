import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { HomeDoctorsCarousel } from '@/components/home/HomeDoctorsCarousel';
import { HomeHeroBanner } from '@/components/home/HomeHeroBanner';
import { HomeQuickActions, type HomeQuickAction } from '@/components/home/HomeQuickActions';
import { HomeVideoChips } from '@/components/home/HomeVideoChips';
import { useSessionStore } from '@/auth/sessionStore';
import { buildHomeContent, withHeroVideoChip } from '@/features/home/homeContent';
import { fetchAllDoctors, type DoctorListEntry } from '@/features/doctors/doctorsApi';
import { openYoutubeVideo } from '@/features/home/openYoutubeVideo';
import { fetchPublicHeroVideoId } from '@/features/home/youtubeHero';
import { openMainTab } from '@/navigation/openTab';
import { colors } from '@/theme/colors';

export default function HomeTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const isLoggedIn = Boolean(accessToken);
  const isDoctor = isLoggedIn && role === 'DOCTOR';
  const [videoId, setVideoId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorListEntry[]>([]);

  const content = useMemo(() => {
    const base = buildHomeContent(t, isDoctor);
    return {
      ...base,
      videoChips: withHeroVideoChip(base.videoChips, videoId)
    };
  }, [t, isDoctor, videoId]);

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

  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchAllDoctors();
        setDoctors(rows);
      } catch {
        setDoctors([]);
      }
    })();
  }, []);

  function requireAuth(onAuthed: () => void) {
    if (!isLoggedIn) {
      router.push('/(auth)/login');
      return;
    }
    onAuthed();
  }

  function onHeroCta() {
    if (isDoctor) {
      openMainTab('ai-diagnosis');
      return;
    }
    requireAuth(() => router.push('/(app)/appointments/book' as never));
  }

  function onBookDoctor(doctor?: DoctorListEntry) {
    requireAuth(() =>
      router.push({
        pathname: '/(app)/appointments/book',
        params: {
          department: doctor?.department ?? '',
          doctorId: doctor?.id ?? ''
        }
      } as never)
    );
  }

  function onSeeAllDoctors() {
    requireAuth(() => router.push('/(app)/doctors' as never));
  }

  const quickActions: HomeQuickAction[] = [
    {
      id: 'schedule',
      label: t('home.launcher.quickActions.schedule'),
      icon: 'calendar-outline',
      tint: colors.primaryDark,
      background: '#ecfdf5',
      onPress: () => {
        if (isDoctor) {
          openMainTab('ai-diagnosis');
          return;
        }
        requireAuth(() => router.push('/(app)/appointments/book' as never));
      }
    },
    {
      id: 'video',
      label: t('home.launcher.quickActions.videoCall'),
      icon: 'videocam-outline',
      tint: '#1d4ed8',
      background: '#eff6ff',
      onPress: () => requireAuth(() => openMainTab('appointments'))
    },
    {
      id: 'rx',
      label: t('home.launcher.quickActions.prescriptions'),
      icon: 'document-text-outline',
      tint: '#b45309',
      background: '#fff7ed',
      onPress: () => requireAuth(() => openMainTab('prescriptions'))
    },
    {
      id: 'ai',
      label: t('home.launcher.quickActions.aiChat'),
      icon: 'chatbubbles-outline',
      tint: '#6d28d9',
      background: '#f5f3ff',
      onPress: () => requireAuth(() => router.push('/(app)/ai-chat' as never))
    }
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <HomeHeroBanner onCta={onHeroCta} ctaLabel={content.heroCta} />

      <View style={styles.body}>
        <HomeQuickActions actions={quickActions} />

        <HomeDoctorsCarousel
          title={t('home.launcher.doctorsTitle')}
          seeAllLabel={t('home.launcher.doctorsSeeAll')}
          bookLabel={t('home.launcher.bookDoctor')}
          doctors={doctors}
          onSeeAll={onSeeAllDoctors}
          onBook={(doctor) => onBookDoctor(doctor)}
        />

        <HomeVideoChips
          title={t('home.launcher.videosTitle')}
          youtubeLabel={t('home.launcher.videosYoutube')}
          videos={content.videoChips}
          onOpenYoutube={() => void openYoutubeVideo(videoId)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingBottom: 108
  },
  body: {
    paddingHorizontal: 16
  }
});
