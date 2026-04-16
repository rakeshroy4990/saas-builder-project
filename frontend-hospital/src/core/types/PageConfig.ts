import type { ActionConfig } from './ActionConfig';
import type { ContainerConfig } from './ComponentDefinition';

export interface PageConfig {
  packageName: string;
  pageId: string;
  title: string;
  /**
   * Optional literal DOM `id` for the page root container (takes precedence over `container.domId`).
   */
  domId?: string;
  container: ContainerConfig;
  actions?: ActionConfig[];
  initializeActions?: ActionConfig[];
  popupButtonStyle?: string[];
  popupContainerStyle?: string[];
}
