import { LOCALE_CONFIG, type LocaleCode } from '@saas-builder/i18n-contract';

export function detectScriptLocale(text: string): LocaleCode | null {
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return null;
}

export function messageFontFamily(locale?: string): string | undefined {
  const code = String(locale ?? '').trim().toLowerCase();
  if (code === 'kn') return 'NotoSansKannada_400Regular';
  if (code === 'hi') return 'NotoSansDevanagari_400Regular';
  return undefined;
}

export function localeBadgeLabel(detectedLocale?: string): string {
  const lang = String(detectedLocale ?? '').trim().toLowerCase();
  if (lang === 'kn') return LOCALE_CONFIG.kn.label;
  if (lang === 'hi') return LOCALE_CONFIG.hi.label;
  return '';
}
