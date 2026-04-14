import type { Router } from 'vue-router';
import type { ActionConfig, NavigationConfig, PopupRequest } from '../types/ActionConfig';
import type { PageConfig } from '../types/PageConfig';
import { resolveMapping, resolveMappings } from './DataMapper';
import { ServiceRegistry } from '../registry/ServiceRegistry';
import { usePopupStore } from '../../store/usePopupStore';

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
        usePopupStore().close();
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

    const response = await service.execute({ data });
    const failed = service.responseCodes?.failure?.includes(response.responseCode) ?? false;

    if (!failed && action.onSuccess) {
      await this.execute(action.onSuccess);
    } else if (failed && action.onFailure) {
      await this.execute(action.onFailure);
    }
  }

  private navigate(nav: NavigationConfig): void {
    this.router.push(`/page/${nav.packageName}/${nav.pageId}`);
  }

  private showPopup(req: PopupRequest): void {
    usePopupStore().open(req);
  }

  private handleGlobalError(err: unknown): void {
    usePopupStore().openError(err);
  }
}
