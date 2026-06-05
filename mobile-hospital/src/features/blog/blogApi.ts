import { pickString, SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';
import { getMobileApiBaseUrl } from '@/api/config';
import { DEFAULT_API_TIMEOUT_MS } from '@/api/timeouts';
import axios from 'axios';

export interface BlogPreview {
  id: string;
  title: string;
  summary: string;
  slug: string;
}

function mapRow(row: Record<string, unknown>, index: number): BlogPreview {
  return {
    id: pickString(row, ['id', 'Id', 'slug', 'Slug']) || `blog-${index}`,
    title: pickString(row, ['title', 'Title', 'headline', 'Headline']) || 'Article',
    summary: pickString(row, ['summary', 'Summary', 'teaser', 'Teaser', 'description', 'Description']),
    slug: pickString(row, ['slug', 'Slug', 'urlSlug', 'UrlSlug'])
  };
}

export async function fetchBlogPreviews(limit = 8): Promise<BlogPreview[]> {
  try {
    const client = apiClient.defaults.headers.Authorization ? apiClient : axios.create({
      baseURL: getMobileApiBaseUrl(),
      timeout: DEFAULT_API_TIMEOUT_MS,
      headers: { Accept: 'application/json' }
    });
    const response = await client.get(SERVER_PATHS.hospitalBlogPreviews, { params: { limit } });
    const data = unwrapEnvelope<unknown>(response.data);
    const list = Array.isArray(data) ? data : [];
    return list
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((row, idx) => mapRow(row, idx));
  } catch {
    return [];
  }
}
