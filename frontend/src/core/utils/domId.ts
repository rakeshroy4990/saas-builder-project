/**
 * Resolved DOM `id` for a component: optional server `domId` wins; otherwise
 * `${idScope}--${definitionId}` or bare `definitionId` when there is no scope.
 */
export function resolveComponentDomId(opts: {
  definitionId: string;
  type: string;
  idScope?: string;
  /** Literal DOM id when provided (e.g. from `/api/ui-metadata`). */
  domId?: string;
}): string {
  const override = opts.domId?.trim();
  if (override) return override;
  const base = opts.definitionId?.trim() || `unnamed-${opts.type}`;
  return opts.idScope ? `${opts.idScope}--${base}` : base;
}

/** Root region id for a page shell container. */
export function resolvePageRootDomId(opts: {
  packageName: string;
  pageId: string;
  pageDomId?: string;
  containerDomId?: string;
  /** When no `domId` overrides are set (e.g. `${pkg}-${page}-page`). */
  fallbackId?: string;
}): string {
  const override = opts.pageDomId?.trim() || opts.containerDomId?.trim();
  if (override) return override;
  return opts.fallbackId ?? `${opts.packageName}-${opts.pageId}-page`;
}

/**
 * Produces a safe fragment for use inside an HTML `id` (alphanumeric, `_`, `-`).
 */
export function sanitizeDomIdSegment(raw: string): string {
  const s = String(raw)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'x';
}
