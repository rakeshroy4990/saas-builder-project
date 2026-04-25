import { nextTick } from 'vue';
import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { router } from '../../../../router';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';

function scrollContactIntoView(): void {
  const node = document.getElementById('hospital-home-contact-section');
  if (node) {
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/** Kept separate so `hospitalServices` concat order matches legacy `services.ts` (after appointment popup). */
export const scrollHomeContactHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'scroll-home-contact',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HeaderUiState', { activeMenu: 'CONTACT' });
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<
        string,
        unknown
      >;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', { ...responsive, headerMenuOpen: false });
      const route = router.currentRoute.value;
      const onHome =
        String(route.params.packageName ?? '') === 'hospital' && String(route.params.pageId ?? '') === 'home';
      if (!onHome) {
        await router.push('/hospital/home');
        await nextTick();
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
      }
      scrollContactIntoView();
      return ok();
    }
  }
];
