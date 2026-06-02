import type { UIAction } from '@saas-builder/extensibility-contract';
import type { Router } from 'vue-router';

export type ExtensionActionContext = {
  user?: { role?: string; userId?: string };
  data?: Record<string, unknown>;
  navigate: (path: string) => void;
  runService: (serviceId: string, data: Record<string, unknown>) => Promise<unknown>;
  showPopup: (pageId: string, data?: Record<string, unknown>) => void;
};

export type ServiceRegistryLike = {
  get(packageName: string, serviceId: string): unknown;
  execute(packageName: string, serviceId: string, data: Record<string, unknown>): Promise<unknown>;
};

const BUILTIN_HANDLER_TYPES = new Set(['navigate', 'showPopup']);

/**
 * Execute a server-defined UI action only when handler maps to a bundled service or built-in navigate/popup.
 */
export async function executeExtensionAction(
  action: UIAction,
  context: ExtensionActionContext,
  serviceRegistry: ServiceRegistryLike,
  packageName: string
): Promise<void> {
  const handlerType = action.handlerType ?? inferHandlerType(action.handler);

  if (handlerType === 'navigate') {
    const pageId = action.navigatePageId ?? action.handler;
    context.navigate(`/${pageId}`);
    return;
  }

  if (handlerType === 'showPopup') {
    const popupId = action.popupPageId ?? action.handler;
    context.showPopup(popupId, context.data);
    return;
  }

  const serviceId = action.handler;
  const sep = serviceId.indexOf('::');
  const pkg = sep >= 0 ? serviceId.slice(0, sep) : packageName;
  const sid = sep >= 0 ? serviceId.slice(sep + 2) : serviceId;

  if (!serviceRegistry.get(pkg, sid)) {
    console.warn(`[ExtensionAction] Unknown service: ${pkg}::${sid}`);
    return;
  }
  await context.runService(`${pkg}::${sid}`, context.data ?? {});
}

function inferHandlerType(handler: string): 'service' | 'navigate' | 'showPopup' {
  if (handler.startsWith('navigate:')) return 'navigate';
  if (handler.startsWith('popup:')) return 'showPopup';
  return 'service';
}

export function buildExtensionActionContext(
  router: Router,
  deps: {
    packageName: string;
    serviceRegistry: ServiceRegistryLike;
    showPopup: (pageId: string, data?: Record<string, unknown>) => void;
    user?: { role?: string; userId?: string };
    data?: Record<string, unknown>;
  }
): ExtensionActionContext {
  return {
    user: deps.user,
    data: deps.data,
    navigate: (path) => {
      void router.push(path.startsWith('/') ? path : `/${path}`);
    },
    runService: async (qualifiedId, data) => {
      const sep = qualifiedId.indexOf('::');
      const pkg = sep >= 0 ? qualifiedId.slice(0, sep) : deps.packageName;
      const sid = sep >= 0 ? qualifiedId.slice(sep + 2) : qualifiedId;
      return deps.serviceRegistry.execute(pkg, sid, data);
    },
    showPopup: deps.showPopup
  };
}

export function isAllowedExtensionHandler(handler: string, handlerType?: string): boolean {
  if (handlerType && BUILTIN_HANDLER_TYPES.has(handlerType)) return true;
  if (handler.startsWith('navigate:') || handler.startsWith('popup:')) return true;
  return handler.includes('::') || /^[a-z0-9-]+$/i.test(handler);
}
