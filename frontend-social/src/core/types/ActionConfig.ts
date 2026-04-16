import type { MappingConfig } from './MappingConfig';

export type ActionType = 'service' | 'navigate' | 'showPopup' | 'closePopup';

export interface NavigationConfig {
  packageName: string;
  pageId: string;
  data?: Record<string, unknown>;
}

export interface PopupRequest {
  pageId: string;
  packageName: string;
  title?: string;
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
