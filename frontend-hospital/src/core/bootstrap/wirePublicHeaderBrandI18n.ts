import type { ComponentDefinition } from '../types/ComponentDefinition';
import type { ContainerConfig } from '../types/ComponentDefinition';
import type { PageConfig } from '../types/PageConfig';
import { PageRegistry } from '../registry/PageRegistry';
import { bumpPageRegistryRevision } from '../registry/pageRegistryRevision';

const TITLE_ID = 'hospital-public-header-title';
const LOGO_ID = 'hospital-public-header-logo';
const BRAND_TITLE_KEY = 'hospital.brandTitle';
const LOGO_ALT_KEY = 'hospital.logoAlt';

function walkComponents(children: ComponentDefinition[] | undefined, visit: (node: ComponentDefinition) => void): void {
  if (!children?.length) return;
  for (const child of children) {
    visit(child);
    const cfg = child.config as ContainerConfig | undefined;
    if (child.type === 'container' && cfg?.children?.length) {
      walkComponents(cfg.children, visit);
    }
    if (child.type === 'list' && cfg && 'itemTemplate' in cfg && cfg.itemTemplate?.children?.length) {
      walkComponents(cfg.itemTemplate.children, visit);
    }
  }
}

function wirePagePublicHeader(page: PageConfig): PageConfig {
  const next = structuredClone(page);
  walkComponents(next.container.children, (node) => {
    if (node.id === TITLE_ID) {
      const cfg = { ...(node.config ?? {}) } as Record<string, unknown>;
      cfg.i18nKey = BRAND_TITLE_KEY;
      delete cfg.text;
      delete cfg.mapping;
      node.config = cfg;
    }
    if (node.id === LOGO_ID) {
      const cfg = { ...(node.config ?? {}) } as Record<string, unknown>;
      cfg.altI18nKey = LOGO_ALT_KEY;
      delete cfg.alt;
      node.config = cfg;
    }
  });
  return next;
}

/**
 * When {@code i18nBundles} defines {@code hospital.brandTitle}, wire the public header to vue-i18n
 * (CMS saves often set literal {@code text} which cannot switch to Hindi).
 */
export function wirePublicHeaderBrandI18nOnAllPages(): void {
  const registry = PageRegistry.getInstance();
  let changed = false;
  registry.forEachPage((page) => {
    const wired = wirePagePublicHeader(page);
    registry.register(wired);
    changed = true;
  });
  if (changed) {
    bumpPageRegistryRevision();
  }
}
