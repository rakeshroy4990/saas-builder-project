import type { MappingConfig } from './MappingConfig';

export type ActionType = 'service' | 'navigate' | 'showPopup' | 'closePopup' | 'reloadWindow';

export interface NavigationConfig {
  packageName: string;
  pageId: string;
  data?: Record<string, unknown>;
}

export interface PopupRequest {
  pageId: string;
  packageName: string;
  title?: string;
  /** When set, GlobalPopup treats each open as a new instance (re-runs `initializeActions`). */
  initKey?: string;
}

export interface ActionConfig {
  alias?: string;
  actionType?: ActionType;
  actionId?: string;
  packageName?: string;
  data?: Record<string, unknown>;
  mapping?: MappingConfig;
  mappings?: Record<string, MappingConfig>;
  navigate?: NavigationConfig;
  popup?: PopupRequest;
  onSuccess?: ActionConfig;
  onFailure?: ActionConfig;
}
