import axios from 'axios';
import { pickString, SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { getMobileApiBaseUrl } from '@/api/config';
import { normalizeYoutubeVideoId } from '@/components/youtubeEmbedHtml';

export async function fetchPublicHeroVideoId(): Promise<string | null> {
  const base = getMobileApiBaseUrl();
  const response = await axios.get(`${base}${SERVER_PATHS.youtubeHeroVideo}`, {
    params: { q: '' },
    timeout: 20_000,
    headers: { Accept: 'application/json' }
  });
  const data = unwrapEnvelope<Record<string, unknown>>(response.data);
  const raw = pickString(data, ['videoId', 'video_id', 'VideoId']);
  return normalizeYoutubeVideoId(raw);
}
