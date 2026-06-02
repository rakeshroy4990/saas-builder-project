/**
 * Stack-agnostic extensibility contracts (L1 static, L2 dynamic UI, L3 endpoint map).
 * Optional `tenantId` reserved for future multi-tenant deployments.
 */

export type UserRole = 'patient' | 'doctor' | 'admin' | 'public';

export interface StaticConfig {
  tenantId?: string | null;
  app: {
    name: string;
    tagline?: string;
    logoUrl: string;
    faviconUrl?: string;
    supportEmail?: string;
  };
  brand: {
    colors: Record<string, string>;
    fonts: Record<string, string>;
    fontSizes: Record<string, string>;
    borderRadius?: string;
    shadowStyle?: 'soft' | 'sharp' | 'none';
  };
  flags: Record<string, boolean>;
  seo: {
    defaultTitle?: string;
    defaultDescription?: string;
    ogImage?: string;
  };
}

export interface NavItem {
  id: string;
  label: string;
  path?: string;
  pageId?: string;
  icon?: string;
  roles?: UserRole[];
  children?: NavItem[];
  action?: string;
  hidden?: boolean;
  badge?: string | number;
  order?: number;
}

export interface UIAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  handler: string;
  handlerType?: 'service' | 'navigate' | 'showPopup';
  navigatePageId?: string;
  popupPageId?: string;
  condition?: string;
  confirm?: string;
}

export interface SlotComponentNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  styleTemplate?: string;
  condition?: { expression: string; mappings?: Record<string, unknown> };
}

export interface DynamicConfig {
  tenantId?: string | null;
  navigation: {
    sidebar: NavItem[];
    topbar: NavItem[];
    footer: NavItem[];
    publicHeader: NavItem[];
  };
  actions: Record<string, UIAction>;
  componentOverrides: Record<string, string>;
  slots: Record<string, SlotComponentNode[]>;
  flags?: Record<string, boolean>;
}

export interface EndpointRouteConfig {
  reroute?: string | null;
  headers?: Record<string, string>;
  hooks?: {
    before?: string[];
    after?: string[];
  };
}

export interface EndpointMap {
  tenantId?: string | null;
  routes: Record<string, EndpointRouteConfig>;
}

export const DEFAULT_STATIC_CONFIG: StaticConfig = {
  tenantId: null,
  app: {
    name: 'Agastya Healthcare',
    tagline: 'AI-Powered Care, Anytime',
    logoUrl: '/assets/logo.svg',
    faviconUrl: '/assets/favicon.ico',
    supportEmail: 'support@agastyahealthcare.com'
  },
  brand: {
    colors: {
      primary: '#0F6B5E',
      secondary: '#1A9E8B',
      accent: '#F5A623',
      danger: '#E53E3E',
      background: '#F7FAFA',
      surface: '#FFFFFF',
      textPrimary: '#1A202C',
      textSecondary: '#718096'
    },
    fonts: {
      heading: "'Sora', sans-serif",
      body: "'DM Sans', sans-serif",
      mono: "'JetBrains Mono', monospace"
    },
    fontSizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem'
    },
    borderRadius: '0.5rem',
    shadowStyle: 'soft'
  },
  flags: {
    enableBlog: true,
    enableAIChat: true,
    enableVideoCall: true,
    enableEducationSection: true,
    enableYoutubeEmbed: true,
    enablePrescriptionDownload: true,
    maintenanceMode: false
  },
  seo: {
    defaultTitle: 'Agastya Healthcare — AI-Powered Telemedicine',
    defaultDescription:
      'Book appointments, consult doctors, and manage your health online.',
    ogImage: '/assets/og-image.jpg'
  }
};

export const DEFAULT_DYNAMIC_CONFIG: DynamicConfig = {
  tenantId: null,
  navigation: {
    sidebar: [],
    topbar: [],
    footer: [],
    publicHeader: []
  },
  actions: {},
  componentOverrides: {},
  slots: {},
  flags: {}
};

export const DEFAULT_ENDPOINT_MAP: EndpointMap = {
  tenantId: null,
  routes: {}
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Deep-merge plain objects; arrays and scalars from override replace base. */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: DeepPartial<T> | null | undefined): T {
  if (!override || typeof override !== 'object') {
    return base;
  }
  const out = { ...base } as T;
  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseVal = base[key];
    const overVal = override[key];
    if (overVal === undefined) continue;
    if (
      overVal !== null &&
      typeof overVal === 'object' &&
      !Array.isArray(overVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      out[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as DeepPartial<Record<string, unknown>>
      ) as T[keyof T];
    } else {
      out[key] = overVal as T[keyof T];
    }
  }
  return out;
}

export function mergeStaticConfig(
  base: StaticConfig,
  override?: DeepPartial<StaticConfig> | null
): StaticConfig {
  return deepMerge(base as unknown as Record<string, unknown>, override ?? {}) as unknown as StaticConfig;
}

export function mergeDynamicConfig(
  base: DynamicConfig,
  override?: DeepPartial<DynamicConfig> | null
): DynamicConfig {
  return deepMerge(base as unknown as Record<string, unknown>, override ?? {}) as unknown as DynamicConfig;
}

/** Normalize HTTP method + path for endpoint map keys. */
export function endpointKey(method: string, path: string): string {
  const m = method.trim().toUpperCase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${m} ${p}`;
}
