import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';

type HeroVideoKind = 'shorts' | 'video' | null;

function inferVideoKindFromTitle(title: string): HeroVideoKind {
  const rawTitle = String(title).trim().toLowerCase();
  if (!rawTitle) return null;
  return /(^|\W)#?shorts?(\W|$)/i.test(rawTitle) ? 'shorts' : 'video';
}

function inferVideoKind(row: Record<string, unknown>): HeroVideoKind {
  return inferVideoKindFromTitle(String(row.video_title ?? row.videoTitle ?? ''));
}

function mergeHeroVideo(videoId: string | null, videoKind: HeroVideoKind): void {
  const appStore = useAppStore(pinia);
  const raw = appStore.getData('hospital', 'HomeContent') as Record<string, unknown> | undefined;
  const prevHero =
    raw && typeof raw.hero === 'object' && raw.hero !== null ? (raw.hero as Record<string, unknown>) : {};
  appStore.setData('hospital', 'HomeContent', {
    ...raw,
    hero: { ...prevHero, videoId, videoKind }
  });
}

/**
 * When logged in: sets `HomeContent.hero.videoId` from the user's most recent `query_cache` row
 * (`GET /api/user/youtube-queries`). Returns true if an interest video was applied.
 */
export async function refreshHeroYoutubeFromUserQueryCache(): Promise<boolean> {
  const appStore = useAppStore(pinia);
  const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const userId = String(session.userId ?? '').trim();
  if (!userId) {
    return false;
  }

  try {
    const res = await apiClient.get(URLRegistry.paths.youtubeUserQueries, {
      params: { limit: 10 }
    });
    const json = res.data as Record<string, unknown>;
    if (json.Success === false || json.success === false) {
      return false;
    }
    const rows = (json.Data ?? json.data ?? []) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }
    const first = rows[0] as Record<string, unknown>;
    const vid = first.video_id ?? first.videoId;
    const id = vid == null || typeof vid !== 'string' || !vid.trim() ? null : vid.trim();
    if (!id) {
      return false;
    }
    mergeHeroVideo(id, inferVideoKind(first));
    return true;
  } catch {
    return false;
  }
}

/**
 * Public hero-video API: empty `q` resolves on the server to a recent channel video ranked by views or likes.
 */
async function refreshHeroYoutubeFromChannelDefault(): Promise<void> {
  try {
    const res = await apiClient.get(URLRegistry.paths.youtubeHeroVideo, {
      params: new URLSearchParams({ q: '' })
    });
    const json = res.data as Record<string, unknown>;
    if (json.Success === false || json.success === false) {
      return;
    }
    const data = (json.Data ?? json.data) as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') {
      return;
    }
    const vid = data.videoId;
    const id = vid == null || typeof vid !== 'string' || !vid.trim() ? null : vid.trim();
    if (!id) {
      return;
    }
    const title = String(data.videoTitle ?? '').trim();
    mergeHeroVideo(id, inferVideoKindFromTitle(title));
  } catch {
    // leave hero unchanged
  }
}

export const resolveHeroYoutubeVideoHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'resolve-hero-youtube-video',
    execute: async () => {
      const fromInterest = await refreshHeroYoutubeFromUserQueryCache();
      if (!fromInterest) {
        await refreshHeroYoutubeFromChannelDefault();
      }
      return ok();
    }
  }
];
