import { computed } from 'vue';
import type { NavItem, UserRole } from '@saas-builder/extensibility-contract';
import { useDynamicConfig } from './useDynamicConfig';

export type NavigationZone = 'sidebar' | 'topbar' | 'footer' | 'publicHeader';

function normalizeRole(role: string | undefined | null): UserRole | null {
  const r = String(role ?? '').trim().toLowerCase();
  if (r === 'patient' || r === 'doctor' || r === 'admin' || r === 'public') {
    return r;
  }
  return null;
}

function filterNavItems(items: NavItem[], userRole: UserRole | null): NavItem[] {
  return items
    .filter((item) => !item.hidden)
    .filter((item) => {
      if (!item.roles?.length) return true;
      if (!userRole) return item.roles.includes('public');
      return item.roles.includes(userRole);
    })
    .map((item) => ({
      ...item,
      children: item.children ? filterNavItems(item.children, userRole) : undefined
    }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function useNavigation(zone: NavigationZone, userRole?: string | null) {
  const { config } = useDynamicConfig();
  const role = normalizeRole(userRole);

  return computed(() => {
    const zoneItems = config.value.navigation[zone] ?? [];
    return filterNavItems(zoneItems, role);
  });
}
