import type { Router } from 'vue-router';
import type { ActionConfig, NavigationConfig, PopupRequest } from '../types/ActionConfig';
import type { PageConfig } from '../types/PageConfig';
import { resolveMapping, resolveMappings } from './DataMapper';
import { ServiceRegistry } from '../registry/ServiceRegistry';
import { usePopupStore } from '../../store/usePopupStore';
import { pinia } from '../../store/pinia';

export class ActionEngine {
  constructor(
    private readonly pageConfig: PageConfig,
    private readonly router: Router
  ) {}

  async execute(actionRef: ActionConfig, inputData?: Record<string, unknown>): Promise<void> {
    const action = this.resolveAction(actionRef);
    const mappedData = action.mappings
      ? resolveMappings(action.mappings)
      : action.mapping
      ? { value: resolveMapping(action.mapping) }
      : {};

    const requestData = { ...mappedData, ...(action.data ?? {}), ...(inputData ?? {}) };

    try {
      if (!action.actionType || action.actionType === 'service') {
        await this.executeService(action, requestData);
      } else if (action.actionType === 'navigate' && action.navigate) {
        this.navigate(action.navigate);
      } else if (action.actionType === 'showPopup' && action.popup) {
        this.showPopup(action.popup);
      } else if (action.actionType === 'closePopup') {
        usePopupStore(pinia).close();
        if (action.onSuccess) {
          await this.execute(action.onSuccess);
        }
      } else if (action.actionType === 'reloadWindow') {
        window.location.reload();
      }
    } catch (err) {
      if (action.onFailure) await this.execute(action.onFailure);
      else this.handleGlobalError(err);
    }
  }

  private resolveAction(ref: ActionConfig): ActionConfig {
    if (ref.alias && this.pageConfig.actions) {
      return this.pageConfig.actions.find((action) => action.alias === ref.alias) ?? ref;
    }
    return ref;
  }

  private async executeService(action: ActionConfig, data: Record<string, unknown>): Promise<void> {
    const packageName = action.packageName ?? this.pageConfig.packageName;
    if (!action.actionId) throw new Error('Missing actionId for service action');

    const service = ServiceRegistry.getInstance().get(packageName, action.actionId);
    if (!service) throw new Error(`Service not found: ${packageName}::${action.actionId}`);

    const popupStore = usePopupStore(pinia);
    if (popupStore.isOpen && !popupStore.isError) {
      popupStore.clearInlineError();
    }
    const response = await service.execute({ data });
    const failed = service.responseCodes?.failure?.includes(response.responseCode) ?? false;

    if (!failed && action.onSuccess) {
      await this.execute(action.onSuccess);
    } else if (failed && action.onFailure) {
      this.setPopupInlineError(response);
      await this.execute(action.onFailure);
    } else if (failed) {
      this.setPopupInlineError(response);
    }
  }

  private navigate(nav: NavigationConfig): void {
    this.router.push(`/${nav.packageName}/${nav.pageId}`);
  }

  private showPopup(req: PopupRequest): void {
    const normalizePopupValue = (value: string | undefined, fallback: string) => {
      const normalized = value?.trim();
      if (!normalized || normalized === '/' || normalized === '\\') return fallback;
      return normalized;
    };

    const normalizedReq: PopupRequest = {
      packageName: normalizePopupValue(req?.packageName, this.pageConfig.packageName),
      // Do not force appointment here; preserve empties so store-level logic can
      // retain current popup intent (e.g. login) instead of being overwritten.
      pageId: normalizePopupValue(req?.pageId, ''),
      title: req?.title,
      initKey: req?.initKey
    };
    usePopupStore(pinia).open(normalizedReq);
  }

  private handleGlobalError(err: unknown): void {
    usePopupStore(pinia).openError(err);
  }

  private setPopupInlineError(response: Record<string, unknown>): void {
    const popupStore = usePopupStore(pinia);
    if (!popupStore.isOpen || popupStore.isError) {
      return;
    }
    const message =
      this.pickString(response, ['message', 'Message', 'errorMessage', 'ErrorMessage']) ||
      'Something went wrong. Please try again.';
    popupStore.setInlineError(message);
  }

  private pickString(payload: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = payload[key];
      if (value == null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return '';
  }
}
