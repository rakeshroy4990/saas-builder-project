import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HomeDoctor } from '@/features/home/homeContent';
import { colors } from '@/theme/colors';

type HomeDoctorsCarouselProps = {
  title: string;
  seeAllLabel: string;
  bookLabel: string;
  doctors: HomeDoctor[];
  onSeeAll: () => void;
  onBook: (doctor: HomeDoctor) => void;
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
          <View key={doctor.name} style={styles.card}>
            <Image source={{ uri: doctor.imageUrl }} style={styles.avatar} accessibilityLabel={doctor.name} />
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
    marginBottom: 24
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
    paddingRight: 4
  },
  card: {
    width: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.background
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
