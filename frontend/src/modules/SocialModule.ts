import { PageRegistry } from '../core/registry/PageRegistry';
import { ServiceRegistry } from '../core/registry/ServiceRegistry';
import { socialPages } from '../configs/social/pages';
import { socialServices } from '../services/domain/social/services';

export function registerSocialModule(): void {
  socialPages.forEach((page) => PageRegistry.getInstance().register(page));
  socialServices.forEach((service) => ServiceRegistry.getInstance().register(service));
}
