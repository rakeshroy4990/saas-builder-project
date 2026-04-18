import BusyDots from './BusyDots.vue';
import { BusyIndicatorRegistry } from './busyIndicatorRegistry';

/** Call once at app startup (e.g. main.ts) so default `busyAnimation: 'dots'` resolves. */
export function registerDefaultBusyIndicators(): void {
  BusyIndicatorRegistry.register(BusyIndicatorRegistry.defaultId, BusyDots);
}
