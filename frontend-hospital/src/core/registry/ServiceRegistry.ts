import type { ServiceDefinition } from '../types/ServiceDefinition';

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private readonly services = new Map<string, ServiceDefinition>();

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register(service: ServiceDefinition): void {
    this.services.set(`${service.packageName}::${service.serviceId}`, service);
  }

  get(packageName: string, serviceId: string): ServiceDefinition | undefined {
    return this.services.get(`${packageName}::${serviceId}`);
  }
}
