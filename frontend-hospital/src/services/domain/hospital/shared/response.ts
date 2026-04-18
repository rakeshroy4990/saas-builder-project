import type { ServiceResponse } from '../../../../core/types/ServiceDefinition';

export function ok(data: Record<string, unknown> = {}): ServiceResponse {
  return { responseCode: 'SUCCESS', ...data };
}
