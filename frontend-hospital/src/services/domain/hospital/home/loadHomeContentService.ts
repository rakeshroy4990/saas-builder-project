import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import { hospitalHomeContent } from '../shared/constants';
import { ensureHospitalWebRtcInboundConnected } from '../shared/hospitalWebRtcInbound';
import { ensureHospitalAdminSupportInboxReady } from '../chat/chatServices';

export const loadHomeContentHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'load-home-content',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HomeContent', hospitalHomeContent);
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
