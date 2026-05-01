import type { ActionConfig } from './ActionConfig';
import type { MappingConfig } from './MappingConfig';
import type { StyleConfig } from './StyleConfig';

export interface ConditionConfig {
  expression: string;
  mappings?: Record<string, MappingConfig>;
}

export type ComponentType =
  | 'button'
  | 'text'
  | 'container'
  | 'input'
  | 'date-picker'
  | 'dropdown'
  | 'list'
  | 'image'
  | 'checkbox'
  | 'radio-group'
  | 'chat'
  | 'video-call'
  | 'doctor-schedule-editor'
  | 'medicine-list-editor';

export interface LayoutConfig {
  type: 'flex' | 'grid';
  flex?: string[];
  grid?: string[];
}

export interface ComponentDefinition {
  /**
   * Stable key for this node; combined with parent scope for the DOM `id`
   * (see renderer `idScope`). Use `{package}-{page}-{role}` style for leaf nodes.
   */
  id: string;
  type: ComponentType;
  /**
   * When set (e.g. from server UI metadata), used as the literal DOM `id` for this
   * component and as the `idScope` prefix for descendants. When omitted, ids are derived from `id` + parent scope.
   */
  domId?: string;
  condition?: ConditionConfig;
  /**
   * When true (same evaluation rules as `condition`), `button` components receive `disabled: true`.
   * Use for role-gated CTAs without hiding the control.
   */
  disabledCondition?: ConditionConfig;
  config?: Record<string, unknown>;
}

export interface ContainerConfig {
  /** Named layout from LayoutTemplateRegistry (preferred over inline `layout`). */
  layoutTemplate?: string;
  layout?: LayoutConfig;
  styles?: StyleConfig;
  /**
   * Literal DOM `id` for this container when it is the page root (overrides default `{package}-{page}-page`).
   */
  domId?: string;
  /** Merged onto the container root element (e.g. `data-profile-menu-root` for click-outside). */
  rootAttrs?: Record<string, string | number | boolean>;
  children: ComponentDefinition[];
  click?: ActionConfig;
}
