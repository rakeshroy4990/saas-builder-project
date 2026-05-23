import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors } from '@/theme/colors';

import {
  buildYoutubeEmbedHtml,
  getYoutubeEmbedOrigin,
  normalizeYoutubeVideoId
} from './youtubeEmbedHtml';

type YouTubeEmbedProps = {
  videoId: string | null;
  title?: string;
};

export function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const normalizedId = useMemo(() => normalizeYoutubeVideoId(videoId), [videoId]);
  const html = useMemo(
    () => (normalizedId ? buildYoutubeEmbedHtml(normalizedId) : ''),
    [normalizedId]
  );
  const baseUrl = getYoutubeEmbedOrigin();
  const watchUrl = normalizedId ? `https://www.youtube.com/watch?v=${normalizedId}` : '';

  if (!normalizedId || !html) {
    return null;
  }

  async function openInYoutube() {
    if (!watchUrl) return;
    await WebBrowser.openBrowserAsync(watchUrl);
  }

  return (
    <View style={styles.wrap}>
      {loading && !failed ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {failed ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>{t('home.hero.videoUnavailable')}</Text>
          <Pressable style={styles.fallbackBtn} onPress={() => void openInYoutube()}>
            <Text style={styles.fallbackBtnText}>{t('home.hero.watchOnYoutube')}</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          source={{ html, baseUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onHttpError={() => {
            setLoading(false);
            setFailed(true);
          }}
          accessibilityLabel={title ?? t('home.hero.videoTitle')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    marginTop: 16,
    marginBottom: 8
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    backgroundColor: '#0f172a'
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#0f172a'
  },
  fallbackTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12
  },
  fallbackBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  fallbackBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  }
});
