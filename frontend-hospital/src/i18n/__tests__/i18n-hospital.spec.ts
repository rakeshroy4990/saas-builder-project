import { describe, expect, it } from 'vitest';
import { isSupportedLocale, normalizeLocaleTag } from '@saas-builder/i18n-contract';
import { SERVER_COPY_ACCEPT_LANGUAGE } from '../serverCopy';

describe('i18n contract + server copy hints', () => {
  it('recognizes supported locales', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('hi')).toBe(true);
    expect(isSupportedLocale('xx')).toBe(false);
  });

  it('normalizes language tags', () => {
    expect(normalizeLocaleTag('hi-IN')).toBe('hi');
    expect(normalizeLocaleTag('en-US')).toBe('en');
  });

  it('exports Accept-Language guidance for API teams', () => {
    expect(SERVER_COPY_ACCEPT_LANGUAGE).toContain('Accept-Language');
  });
});
