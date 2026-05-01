import { onMounted, onUnmounted } from 'vue';
import { useAppStore } from '../store/useAppStore';
import { pinia } from '../store/pinia';

const PROFILE_MENU_ROOT = '[data-profile-menu-root]';

/**
 * Closes the hospital header profile dropdown when the user presses/taps outside
 * any element marked with `data-profile-menu-root` (see container `rootAttrs`).
 */
export function useHospitalProfileMenuPointerOutsideClose(): void {
  const onPointerDownCapture = (event: PointerEvent) => {
    const appStore = useAppStore(pinia);
    const header = (appStore.getData('hospital', 'HeaderUiState') ?? {}) as Record<string, unknown>;
    if (!Boolean(header.profileMenuOpen)) return;

    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.closest(PROFILE_MENU_ROOT)) return;

    appStore.setData('hospital', 'HeaderUiState', { ...header, profileMenuOpen: false });
  };

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDownCapture, true);
  });
  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDownCapture, true);
  });
}
