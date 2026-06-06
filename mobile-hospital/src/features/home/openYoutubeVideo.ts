import * as WebBrowser from 'expo-web-browser';

import { normalizeYoutubeVideoId } from '@/components/youtubeEmbedHtml';

export async function openYoutubeVideo(videoId: string | null | undefined): Promise<void> {
  const id = normalizeYoutubeVideoId(videoId);
  if (!id) return;
  await WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${id}`);
}

export function youtubeThumbnailUrl(videoId: string | null | undefined): string | null {
  const id = normalizeYoutubeVideoId(videoId);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
