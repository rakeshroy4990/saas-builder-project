import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DoctorAvatar } from '@/components/DoctorAvatar';
import type { DoctorListEntry } from '@/features/doctors/doctorsApi';
import { colors } from '@/theme/colors';
import { HOME_CAROUSEL_CARD_WIDTH, SCREEN_GUTTER, SECTION_GAP, SURFACE_RADIUS } from '@/theme/layout';

type HomeDoctorsCarouselProps = {
  title: string;
  seeAllLabel: string;
  bookLabel: string;
  doctors: DoctorListEntry[];
  onSeeAll: () => void;
  onBook: (doctor: DoctorListEntry) => void;
};

export function HomeDoctorsCarousel({
  title,
  seeAllLabel,
  bookLabel,
  doctors,
  onSeeAll,
  onBook
}: HomeDoctorsCarouselProps) {
  if (doctors.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onSeeAll} accessibilityRole="button">
          <Text style={styles.seeAll}>{seeAllLabel}</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {doctors.map((doctor) => (
          <View key={doctor.id} style={styles.card}>
            <DoctorAvatar
              profilePic={doctor.profilePic}
              imageUrl={doctor.imageUrl}
              name={doctor.name}
              size={72}
              borderRadius={12}
            />
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {doctor.name}
              </Text>
              <Text style={styles.detail} numberOfLines={2}>
                {doctor.cardLine}
              </Text>
              <Pressable
                style={styles.bookBtn}
                onPress={() => onBook(doctor)}
                accessibilityRole="button"
                accessibilityLabel={`${bookLabel} ${doctor.name}`}
              >
                <Text style={styles.bookBtnText}>{bookLabel}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SECTION_GAP
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  },
  row: {
    gap: 12,
    paddingRight: SCREEN_GUTTER
  },
  card: {
    width: HOME_CAROUSEL_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: SURFACE_RADIUS + 2,
    padding: 12
  },
  meta: {
    flex: 1,
    minWidth: 0
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  detail: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 10
  },
  bookBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  }
});
