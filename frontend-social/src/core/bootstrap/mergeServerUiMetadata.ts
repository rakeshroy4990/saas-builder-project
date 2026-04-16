import type { ComponentDefinition, ComponentType, ContainerConfig } from '../types/ComponentDefinition';
import type { PageConfig } from '../types/PageConfig';
import { PageRegistry } from '../registry/PageRegistry';
import { bumpPageRegistryRevision } from '../registry/pageRegistryRevision';

export interface UiMetadataPackage {
  packageName: string;
  pages: Array<Partial<PageConfig> & { pageId: string }>;
}

export interface UiMetadataResponse {
  version?: string;
  packages?: UiMetadataPackage[];
}

export interface UiMetadataResponse {
  version?: string;
  packages?: UiMetadataPackage[];
}

function mergeChildrenById(
  localChildren: ComponentDefinition[],
  remoteChildren: Partial<ComponentDefinition>[]
): ComponentDefinition[] {
  if (!remoteChildren?.length) return localChildren;
  const remoteById = new Map(
    remoteChildren.filter((c): c is Partial<ComponentDefinition> & { id: string } => Boolean(c?.id)).map((c) => [
      c.id,
      c
    ])
  );
  return localChildren.map((child) => {
    const r = remoteById.get(child.id);
    return r ? mergeComponentDefinition(child, r) : child;
  });
}

function mergeContainerConfig(local: ContainerConfig, remote: Partial<ContainerConfig>): ContainerConfig {
  const out: ContainerConfig = {
    ...local,
    ...(remote.domId !== undefined ? { domId: remote.domId } : {}),
    ...(remote.layoutTemplate !== undefined ? { layoutTemplate: remote.layoutTemplate } : {}),
    ...(remote.styles !== undefined ? { styles: remote.styles } : {}),
    ...(remote.layout !== undefined ? { layout: remote.layout } : {}),
    ...(remote.click !== undefined ? { click: remote.click } : {}),
    children:
      remote.children !== undefined && remote.children.length > 0
        ? mergeChildrenById(local.children, remote.children as Partial<ComponentDefinition>[])
        : local.children
  };
  return out;
}

function mergeComponentConfig(
  type: ComponentType,
  localConfig: Record<string, unknown> | undefined,
  remoteConfig: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!remoteConfig) return localConfig;
  if (!localConfig) return { ...remoteConfig };

  const out: Record<string, unknown> = { ...localConfig, ...remoteConfig };

  if (type === 'container') {
    const lc = localConfig as { children?: ComponentDefinition[] };
    const rc = remoteConfig as { children?: Partial<ComponentDefinition>[] };
    if (rc.children?.length && lc.children?.length) {
      out.children = mergeChildrenById(lc.children, rc.children);
    } else {
      out.children = lc.children;
    }
  }

  if (type === 'list') {
    const lc = localConfig as { itemTemplate?: ContainerConfig; [k: string]: unknown };
    const rc = remoteConfig as { itemTemplate?: Partial<ContainerConfig>; [k: string]: unknown };
    if (rc.itemTemplate && lc.itemTemplate) {
      out.itemTemplate = mergeContainerConfig(lc.itemTemplate, rc.itemTemplate);
    } else {
      out.itemTemplate = lc.itemTemplate;
    }
  }

  return out;
}

function mergeComponentDefinition(
  local: ComponentDefinition,
  remote: Partial<ComponentDefinition>
): ComponentDefinition {
  const next: ComponentDefinition = {
    ...local,
    ...(remote.domId !== undefined ? { domId: remote.domId } : {}),
    ...(remote.condition !== undefined ? { condition: remote.condition } : {})
  };
  if (remote.config !== undefined) {
    next.config = mergeComponentConfig(local.type, local.config, remote.config) as Record<string, unknown>;
  }
  return next;
}

export function mergePageWithServerPatch(local: PageConfig, remote: Partial<PageConfig>): PageConfig {
  const out: PageConfig = structuredClone(local);

  if (remote.domId !== undefined) out.domId = remote.domId;
  if (remote.title !== undefined) out.title = remote.title;
  if (remote.initializeActions !== undefined) out.initializeActions = remote.initializeActions;
  if (remote.actions !== undefined) out.actions = remote.actions;
  if (remote.popupButtonStyle !== undefined) out.popupButtonStyle = remote.popupButtonStyle;
  if (remote.popupContainerStyle !== undefined) out.popupContainerStyle = remote.popupContainerStyle;

  if (remote.container) {
    out.container = mergeContainerConfig(out.container, remote.container);
  }

  return out;
}

/**
 * Applies server UI metadata onto already-registered pages. Unknown pages are skipped.
 * Remote `container.children` entries are matched by `id` and merged; omitted ids are unchanged.
 */
export function applyServerUiMetadataPackages(packages: UiMetadataPackage[]): void {
  const registry = PageRegistry.getInstance();
  let changed = false;

  for (const pkg of packages) {
    if (!pkg?.packageName || !Array.isArray(pkg.pages)) continue;
    for (const remotePage of pkg.pages) {
      if (!remotePage?.pageId) continue;
      const local = registry.get(pkg.packageName, remotePage.pageId);
      if (!local) continue;
      const merged = mergePageWithServerPatch(local, remotePage);
      registry.register(merged);
      changed = true;
    }
  }

  if (changed) bumpPageRegistryRevision();
}
