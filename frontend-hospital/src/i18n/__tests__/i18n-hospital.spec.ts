import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isSupportedLocale, normalizeLocaleTag } from '@saas-builder/i18n-contract';
import { SERVER_COPY_ACCEPT_LANGUAGE } from '../serverCopy';

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...leafKeys(v as Record<string, unknown>, p));
    } else {
      keys.push(p);
    }
  }
  return keys.sort();
}

describe('i18n contract + server copy hints', () => {
  it('recognizes supported locales', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('hi')).toBe(true);
    expect(isSupportedLocale('kn')).toBe(true);
    expect(isSupportedLocale('xx')).toBe(false);
  });

  it('normalizes language tags', () => {
    expect(normalizeLocaleTag('hi-IN')).toBe('hi');
    expect(normalizeLocaleTag('kn-IN')).toBe('kn');
    expect(normalizeLocaleTag('en-US')).toBe('en');
  });

  it('exports Accept-Language guidance for API teams', () => {
    expect(SERVER_COPY_ACCEPT_LANGUAGE).toContain('Accept-Language');
  });

  it('keeps en/hi/kn message bundles in parity', () => {
    const root = resolve(import.meta.dirname, '../../locales');
    const en = JSON.parse(readFileSync(resolve(root, 'en/messages.json'), 'utf8')) as Record<string, unknown>;
    const hi = JSON.parse(readFileSync(resolve(root, 'hi/messages.json'), 'utf8')) as Record<string, unknown>;
    const kn = JSON.parse(readFileSync(resolve(root, 'kn/messages.json'), 'utf8')) as Record<string, unknown>;
    const enKeys = leafKeys(en);
    expect(leafKeys(hi)).toEqual(enKeys);
    expect(leafKeys(kn)).toEqual(enKeys);
  });
});
