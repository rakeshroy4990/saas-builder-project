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

/** When present on {@link ActionEngine.execute}, records a {@code button_click} session summary row. */
export interface ActionRunTelemetryContext {
  component_id: string;
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
