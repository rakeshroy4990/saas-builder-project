import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../store/useAppStore';

const ok = (data: Record<string, unknown> = {}) => ({ responseCode: 'SUCCESS', ...data });

export const socialServices: ServiceDefinition[] = [
  {
    packageName: 'social',
    serviceId: 'load-feed',
    execute: async () => {
      useAppStore().setData('social', 'Feed', {
        posts: [{ id: '1', body: 'Welcome to dynamic feed' }]
      });
      return ok();
    }
  },
  { packageName: 'social', serviceId: 'load-profile', execute: async () => ok() },
  { packageName: 'social', serviceId: 'load-messages', execute: async () => ok() }
];
