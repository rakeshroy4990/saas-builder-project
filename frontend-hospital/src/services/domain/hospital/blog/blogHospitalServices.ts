import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { router } from '../../../../router';
import { apiClient } from '../../../http/apiClient';
import { hospitalBlogPreviewBySlugPath, URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';

function envelopeData(root: unknown): unknown {
  const row = (root ?? {}) as Record<string, unknown>;
  return row.Data ?? row.data ?? root;
}

/** Matches server-side filter: skip one-line list blurbs (blog list + article view). */
const MIN_ARTICLE_CHARS = 520;
const MIN_ARTICLE_WORDS = 90;

function isSubstantialBlogPost(post: Record<string, unknown>): boolean {
  const teaser = String(post.teaser ?? '').trim();
  if (teaser.length < MIN_ARTICLE_CHARS) return false;
  const words = teaser.split(/\s+/).filter((w) => w.length > 0).length;
  return words >= MIN_ARTICLE_WORDS;
}

function readCuriosityQuestionStrings(row: Record<string, unknown>): string[] {
  const raw = row.curiosityQuestions ?? row.CuriosityQuestions;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter((s) => s.length > 0);
}

function deriveHookFromTeaser(teaser: string): string {
  const t = teaser.trim();
  if (!t) return '';
  const m = t.match(/^[^.!?]+[.!?]/);
  if (m && m[0].length >= 12 && m[0].length <= 200) return m[0].trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

function ensureHook(row: Record<string, unknown>, teaser: string): string {
  let h = pickString(row, ['Hook', 'hook']).trim();
  if (h.length > 200) h = `${h.slice(0, 197)}…`;
  if (h.length > 0) return h;
  return deriveHookFromTeaser(teaser);
}

function buildCuriosityQuestionsBlock(questions: string[], title: string): string {
  const q = [...questions];
  while (q.length < 2) {
    q.push(
      q.length === 0
        ? `What is the first thing you would want to explore about “${title}”?`
        : 'What questions could you bring to a routine visit after reading the full article?'
    );
  }
  return q
    .slice(0, 2)
    .map((line) => (line.startsWith('•') ? line : `• ${line}`))
    .join('\n');
}

function parseBlogPayload(raw: unknown): {
  posts: ReturnType<typeof normalizePreview>[];
  contentSource: string;
  contentSourceDetail: string;
  servedFromCache: boolean;
} {
  if (Array.isArray(raw)) {
    const posts = raw
      .map((entry, idx) => normalizePreview(entry, idx))
      .filter((post) => isSubstantialBlogPost(post));
    return {
      posts,
      contentSource: 'unknown',
      contentSourceDetail:
        'Data returned as a plain list (legacy API). Source attribution may be incomplete.',
      servedFromCache: false
    };
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  const itemsRaw = o.Items ?? o.items;
  const list = Array.isArray(itemsRaw) ? itemsRaw : [];
  const posts = list
    .map((entry, idx) => normalizePreview(entry, idx))
    .filter((post) => isSubstantialBlogPost(post));
  const contentSource = pickString(o, ['ContentSource', 'contentSource']).trim();
  let contentSourceDetail = pickString(o, ['ContentSourceDetail', 'contentSourceDetail']).trim();
  const servedRaw = o.ServedFromCache ?? o.servedFromCache;
  const servedFromCache = servedRaw === true || servedRaw === 'true';
  if (!contentSourceDetail) {
    contentSourceDetail =
      contentSource === 'llm'
        ? 'Teasers from an AI model. Refresh may reuse server cache.'
        : contentSource === 'static_fallback'
          ? 'Curated static teasers.'
          : 'Teasers from the hospital blog API.';
  }
  return { posts, contentSource, contentSourceDetail, servedFromCache };
}

function normalizePreview(entry: unknown, idx: number): Record<string, unknown> {
  const row = (entry ?? {}) as Record<string, unknown>;
  const title = pickString(row, ['Title', 'title']).trim() || `Article ${idx + 1}`;
  const slug = pickString(row, ['Slug', 'slug']).trim() || `post-${idx + 1}`;
  let teaser = pickString(row, ['Teaser', 'teaser']).trim();
  const body = pickString(row, ['Body', 'body']).trim();
  const article = pickString(row, ['Article', 'article']).trim();
  if (article.length > teaser.length) teaser = article;
  if (body.length > teaser.length) teaser = body;
  const category = pickString(row, ['Category', 'category']).trim() || 'Wellness';
  const readRaw = row.ReadTimeMinutes ?? row.readTimeMinutes;
  const readTime =
    typeof readRaw === 'number' && Number.isFinite(readRaw)
      ? Math.round(readRaw)
      : Number.parseInt(String(readRaw ?? '5'), 10) || 5;
  const hook = ensureHook(row, teaser);
  const curiosityQuestionsText = buildCuriosityQuestionsBlock(readCuriosityQuestionStrings(row), title);
  return {
    title,
    slug,
    teaser,
    hook,
    curiosityQuestionsText,
    category,
    readTimeMinutes: readTime
  };
}

export const blogHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'load-blog-previews',
    execute: async () => {
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'BlogPreviews', {
        loading: true,
        error: '',
        posts: [],
        contentSource: '',
        contentSourceDetail: '',
        servedFromCache: false
      });
      try {
        const response = await apiClient.get(URLRegistry.paths.hospitalBlogPreviews, { params: { limit: 8 } });
        const raw = envelopeData(response.data);
        const { posts, contentSource, contentSourceDetail, servedFromCache } = parseBlogPayload(raw);
        appStore.setData('hospital', 'BlogPreviews', {
          loading: false,
          error: '',
          posts,
          contentSource,
          contentSourceDetail,
          servedFromCache
        });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load articles.'
          : 'Unable to load articles.';
        appStore.setData('hospital', 'BlogPreviews', {
          loading: false,
          error: message,
          posts: [],
          contentSource: '',
          contentSourceDetail: '',
          servedFromCache: false
        });
        return { responseCode: 'BLOG_LOAD_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-blog-read-more-popup',
    execute: async ({ data }) => {
      const row = (data ?? {}) as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const teaser = String(row.teaser ?? '').trim();
      const slug = String(row.slug ?? '').trim();
      const category = String(row.category ?? '').trim();
      const readRaw = row.readTimeMinutes;
      const readTimeMinutes =
        typeof readRaw === 'number' && Number.isFinite(readRaw)
          ? String(Math.round(readRaw))
          : String(readRaw ?? '5').trim() || '5';
      const metaLine = category
        ? `${category} · ${readTimeMinutes} min read`
        : `${readTimeMinutes} min read`;
      const slugLine = slug ? `Reference: ${slug}` : '';
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'BlogReadMore', {
        title,
        teaser,
        slug,
        category,
        readTimeMinutes,
        metaLine,
        slugLine
      });
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'blog-read-more-popup',
        title: 'Preview'
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'load-blog-article-preview',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const routeRow = (appStore.getData('hospital', 'BlogArticleRoute') ?? {}) as Record<string, unknown>;
      const slug = String(routeRow.slug ?? '').trim();
      appStore.setData('hospital', 'BlogArticleView', {
        loading: true,
        error: '',
        title: '',
        teaser: '',
        slug: '',
        category: '',
        readTimeMinutes: 0,
        metaLine: ''
      });
      if (!slug) {
        appStore.setData('hospital', 'BlogArticleView', {
          loading: false,
          error: 'Missing article address.',
          title: '',
          teaser: '',
          slug: '',
          category: '',
          readTimeMinutes: 0,
          metaLine: ''
        });
        return ok();
      }
      try {
        const response = await apiClient.get(hospitalBlogPreviewBySlugPath(slug));
        const raw = envelopeData(response.data);
        const post = normalizePreview(raw, 0);
        const readTime = Number(post.readTimeMinutes ?? 0) || 0;
        const category = String(post.category ?? '').trim();
        const metaLine = category
          ? `${category} · ${readTime} min read`
          : `${readTime} min read`;
        appStore.setData('hospital', 'BlogArticleView', {
          loading: false,
          error: '',
          title: post.title,
          teaser: post.teaser,
          slug: post.slug,
          category: post.category,
          readTimeMinutes: readTime,
          metaLine
        });
        return ok();
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          appStore.setData('hospital', 'BlogArticleView', {
            loading: false,
            error:
              'This teaser was not found. It may have rotated out of the server cache—open Wellness Blog and choose a current article.',
            title: '',
            teaser: '',
            slug,
            category: '',
            readTimeMinutes: 0,
            metaLine: ''
          });
          return ok();
        }
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load article.'
          : 'Unable to load article.';
        appStore.setData('hospital', 'BlogArticleView', {
          loading: false,
          error: message,
          title: '',
          teaser: '',
          slug,
          category: '',
          readTimeMinutes: 0,
          metaLine: ''
        });
        return { responseCode: 'BLOG_ARTICLE_LOAD_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'navigate-blog-article',
    execute: async ({ data }) => {
      const slug = String((data ?? {}).slug ?? '').trim();
      if (!slug) {
        return { responseCode: 'MISSING_SLUG', message: 'Missing slug', suppressPopupInlineError: true };
      }
      await router.push(`/blog/${encodeURIComponent(slug)}`);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'navigate-blog-article-from-popup',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const row = (appStore.getData('hospital', 'BlogReadMore') ?? {}) as Record<string, unknown>;
      const slug = String(row.slug ?? '').trim();
      if (!slug) {
        return { responseCode: 'MISSING_SLUG', message: 'Missing slug', suppressPopupInlineError: true };
      }
      await router.push(`/blog/${encodeURIComponent(slug)}`);
      usePopupStore(pinia).close();
      return ok();
    }
  }
];
