import { PageRegistry } from '../core/registry/PageRegistry';
import { ServiceRegistry } from '../core/registry/ServiceRegistry';
import { hospitalPages } from '../configs/hospital/pages';
import { hospitalServices } from '../services/domain/hospital/services';

export function registerHospitalModule(): void {
  hospitalPages.forEach((page) => PageRegistry.getInstance().register(page));
  hospitalServices.forEach((service) => ServiceRegistry.getInstance().register(service));
}
