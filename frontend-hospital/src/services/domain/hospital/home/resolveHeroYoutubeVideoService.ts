import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';

function mergeHeroVideoId(videoId: string | null): void {
  const appStore = useAppStore(pinia);
  const raw = appStore.getData('hospital', 'HomeContent') as Record<string, unknown> | undefined;
  const prevHero =
    raw && typeof raw.hero === 'object' && raw.hero !== null ? (raw.hero as Record<string, unknown>) : {};
  appStore.setData('hospital', 'HomeContent', {
    ...raw,
    hero: { ...prevHero, videoId }
  });
}

/**
 * Sets `HomeContent.hero.videoId` from the user's most recent row in Mongo `query_cache`
 * (`GET /api/user/youtube-queries`). Does not call YouTube search.
 * Use on home init and after login — not on every Smart AI reply.
 */
export async function refreshHeroYoutubeFromUserQueryCache(): Promise<void> {
  const appStore = useAppStore(pinia);
  const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const userId = String(session.userId ?? '').trim();
  if (!userId) {
    mergeHeroVideoId(null);
    return;
  }

  try {
    const res = await apiClient.get(URLRegistry.paths.youtubeUserQueries, {
      params: { userId, limit: 10 }
    });
    const json = res.data as Record<string, unknown>;
    if (json.Success === false || json.success === false) {
      mergeHeroVideoId(null);
      return;
    }
    const rows = (json.Data ?? json.data ?? []) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) {
      mergeHeroVideoId(null);
      return;
    }
    const first = rows[0] as Record<string, unknown>;
    const vid = first.video_id ?? first.videoId;
    const id = vid == null || typeof vid !== 'string' || !vid.trim() ? null : vid.trim();
    mergeHeroVideoId(id);
  } catch {
    mergeHeroVideoId(null);
  }
}

export const resolveHeroYoutubeVideoHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'resolve-hero-youtube-video',
    execute: async () => {
      await refreshHeroYoutubeFromUserQueryCache();
      return ok();
    }
  }
];
