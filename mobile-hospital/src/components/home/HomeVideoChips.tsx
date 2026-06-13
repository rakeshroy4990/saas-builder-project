import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HomeVideoChip } from '@/features/home/homeContent';
import { openYoutubeVideo, youtubeThumbnailUrl } from '@/features/home/openYoutubeVideo';
import { colors } from '@/theme/colors';
import { HOME_CAROUSEL_CARD_WIDTH, SCREEN_GUTTER, SECTION_GAP, SURFACE_RADIUS } from '@/theme/layout';

type HomeVideoChipsProps = {
  title: string;
  youtubeLabel: string;
  videos: HomeVideoChip[];
  onOpenYoutube: () => void;
};

export function HomeVideoChips({ title, youtubeLabel, videos, onOpenYoutube }: HomeVideoChipsProps) {
  const visible = videos.filter((video) => video.videoId);
  if (visible.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onOpenYoutube} accessibilityRole="button">
          <Text style={styles.youtubeLink}>{youtubeLabel}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {visible.map((video) => {
          const thumb = youtubeThumbnailUrl(video.videoId);
          return (
            <Pressable
              key={video.id}
              style={styles.chip}
              onPress={() => void openYoutubeVideo(video.videoId)}
              accessibilityRole="button"
              accessibilityLabel={video.title}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} accessibilityIgnoresInvertColors />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]} />
              )}
              <Text style={styles.chipTitle} numberOfLines={2}>
                {video.title}
              </Text>
            </Pressable>
          );
        })}
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
  youtubeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  },
  row: {
    gap: 12,
    paddingRight: SCREEN_GUTTER
  },
  chip: {
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
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#fee2e2'
  },
  thumbFallback: {
    backgroundColor: colors.background
  },
  chipTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18
  }
});
