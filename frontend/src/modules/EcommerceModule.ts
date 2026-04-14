import { PageRegistry } from '../core/registry/PageRegistry';
import { ServiceRegistry } from '../core/registry/ServiceRegistry';
import { ecommercePages } from '../configs/ecommerce/pages';
import { ecommerceServices } from '../services/domain/ecommerce/services';

export function registerEcommerceModule(): void {
  ecommercePages.forEach((page) => PageRegistry.getInstance().register(page));
  ecommerceServices.forEach((service) => ServiceRegistry.getInstance().register(service));
}
