import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import type { Composer } from 'vue-i18n';
import { i18n } from '../../../../i18n';
import { buildHospitalHomeContent } from './localizedHospitalHomeContent';
import { ensureHospitalWebRtcInboundConnected } from '../shared/hospitalWebRtcInbound';
import { ensureHospitalAdminSupportInboxReady } from '../chat/chatServices';
import { logClient } from '../../../logging/clientLogger';

export const loadHomeContentHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'load-home-content',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const existing = appStore.getData('hospital', 'HomeContent') as Record<string, unknown> | undefined;
      const g = i18n.global as Composer;
      try {
        appStore.setData('hospital', 'HomeContent', buildHospitalHomeContent(g.t.bind(g), existing ?? null));
      } catch (error) {
        await logClient('ERROR', 'Failed to build localized HomeContent', {
          reason: error instanceof Error ? error.message : String(error)
        });
        if (existing && typeof existing === 'object') {
          // Keep existing content when translation payload is temporarily invalid.
          appStore.setData('hospital', 'HomeContent', existing);
        }
      }
      const currentSession = useAppStore(pinia).getData('hospital', 'AuthSession') as
        | Record<string, unknown>
        | undefined;
      if (!currentSession?.userDisplayName) {
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', 'Login');
      }
      if (!currentSession?.loginDisplayName) {
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'loginDisplayName', 'Login');
      }
      if (!currentSession?.fullName) {
        const fallbackDisplayName = String(currentSession?.userDisplayName ?? '').trim();
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthSession',
          'fullName',
          fallbackDisplayName && fallbackDisplayName !== 'Login' ? fallbackDisplayName : ''
        );
      }
      const sessionForWs = useAppStore(pinia).getData('hospital', 'AuthSession') as Record<string, unknown> | undefined;
      if (String(sessionForWs?.userId ?? '').trim()) {
        try {
          await ensureHospitalWebRtcInboundConnected();
        } catch {
          // Non-fatal
        }
        if (String(sessionForWs?.role ?? '').trim().toUpperCase() === 'ADMIN') {
          try {
            await ensureHospitalAdminSupportInboxReady();
          } catch {
            // Non-fatal
          }
        }
      }
      return ok();
    }
  }
];
