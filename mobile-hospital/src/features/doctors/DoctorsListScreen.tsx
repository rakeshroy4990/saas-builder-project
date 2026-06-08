import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { LoadingView } from '@/components/LoadingView';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import { fetchDoctorsGroupedByDepartment, type DepartmentDoctorsSection } from './doctorsApi';

export function DoctorsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [sections, setSections] = useState<DepartmentDoctorsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const grouped = await fetchDoctorsGroupedByDepartment();
      setSections(grouped);
    } catch {
      setError(t('doctors.list.loadError'));
      setSections([]);
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function onBookDoctor(section: DepartmentDoctorsSection, doctorId: string) {
    if (!useSessionStore.getState().accessToken) {
      router.push('/(auth)/login');
      return;
    }
    router.push({
      pathname: '/(app)/appointments/book',
      params: {
        department: section.departmentValue,
        doctorId
      }
    } as never);
  }

  if (loading) {
    return <LoadingView />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.subtitle}>{t('doctors.list.subtitle')}</Text>

      {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

      {!error && sections.length === 0 ? (
        <Text style={sharedStyles.subtitle}>{t('doctors.list.empty')}</Text>
      ) : null}

      {sections.map((section) => (
        <View key={section.departmentId} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.departmentLabel}</Text>
          <Text style={styles.sectionMeta}>
            {t('doctors.list.doctorCount', { count: section.doctors.length })}
          </Text>

          {section.doctors.map((doctor) => (
            <View key={doctor.id} style={sharedStyles.card}>
              <View style={styles.cardRow}>
                <DoctorAvatar
                  profilePic={doctor.profilePic}
                  imageUrl={doctor.imageUrl}
                  name={doctor.name}
                  size={56}
                  borderRadius={12}
                />
                <View style={styles.cardBody}>
                  <Text style={sharedStyles.cardTitle}>{doctor.name}</Text>
                  {doctor.speciality ? <Text style={sharedStyles.cardMeta}>{doctor.speciality}</Text> : null}
                  {doctor.qualifications ? <Text style={sharedStyles.cardMeta}>{doctor.qualifications}</Text> : null}
                  {doctor.experienceSummary ? <Text style={sharedStyles.cardMeta}>{doctor.experienceSummary}</Text> : null}
                  {doctor.email ? <Text style={sharedStyles.cardMeta}>{doctor.email}</Text> : null}
                </View>
              </View>
              <Pressable
                style={styles.bookBtn}
                onPress={() => onBookDoctor(section, doctor.id)}
                accessibilityRole="button"
                accessibilityLabel={t('doctors.list.bookDoctor', { name: doctor.name })}
              >
                <Text style={styles.bookBtnText}>{t('doctors.list.book')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32
  },
  subtitle: {
    ...sharedStyles.subtitle,
    marginBottom: 16
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  sectionMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12
  },
  cardBody: {
    flex: 1,
    minWidth: 0
  },
  bookBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5'
  },
  bookBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark
  }
});
