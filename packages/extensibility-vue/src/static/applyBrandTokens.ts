import type { StaticConfig } from '@saas-builder/extensibility-contract';

/** Inject L1 brand tokens as CSS custom properties on :root. */
export function applyBrandTokensToDom(config: StaticConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { colors, fonts, fontSizes, borderRadius } = config.brand;

  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--brand-${camelToKebab(key)}`, value);
  }
  for (const [key, value] of Object.entries(fonts)) {
    root.style.setProperty(`--font-${camelToKebab(key)}`, value);
  }
  for (const [key, value] of Object.entries(fontSizes)) {
    root.style.setProperty(`--text-${key}`, value);
  }
  if (borderRadius) {
    root.style.setProperty('--radius', borderRadius);
  }

  const favicon = config.app.faviconUrl?.trim();
  if (favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }

  if (config.seo.defaultTitle) {
    const existing = document.querySelector('title');
    if (existing && !existing.dataset.extensibilityLocked) {
      existing.textContent = config.seo.defaultTitle;
    }
  }
}

function camelToKebab(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
